"""Transcribe the user's investor lists of 2026-11-12 into seed CSVs.

    uv run python -m atlas.ingest.transcribe_lists      (from pipeline/)

The originals stay in data/raw/sources/; the CSVs in data/seed/ are what the pipeline
reads (`seeds.read_listed`). Text is kept as each list states it, with three exceptions:
every email address is dropped (public professional information only), web addresses
get a scheme ("www.x.vc" -> "https://www.x.vc"), and the names in `RENAMES` are
completed where the PDF print cut them off. Cells the PDF print cut off end in "…";
the row's note says so.
"""

import csv
import re
from collections.abc import Iterable
from dataclasses import asdict, dataclass, fields
from pathlib import Path

import openpyxl
import pdfplumber

from atlas.config import RAW_SOURCES, SEED_DIR


@dataclass
class ListedRow:
    name: str
    name_as_listed: str = ""
    type_as_listed: str = ""
    stages_as_listed: str = ""
    location_as_listed: str = ""
    focus_as_listed: str = ""
    check_as_listed: str = ""
    about_as_listed: str = ""
    website: str = ""
    linkedin: str = ""
    tags: str = ""  # "; "-separated extra tags drawn from the list's own words
    note: str = ""


COLUMNS = [f.name for f in fields(ListedRow)]

# Tags for a stated founder focus. Only the list's own words count; a sector such as
# "women's health" is not a founder focus.
FEMALE_FOUNDERS = re.compile(
    r"\b(female|women|woman)[\s-]*(led|founders?|founded|entrepreneurs?|ceos?)\b", re.I
)
MINORITY_FOUNDERS = re.compile(
    r"\b(minority|underrepresented|under-represented|diverse|black|latinx?|latina|bipoc|poc)"
    r"[\s-]*(led|founders?|founded|entrepreneurs?|teams?)\b",
    re.I,
)
FEMALE_TAG = "Female founders focus"
MINORITY_TAG = "Minority founders focus"

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
URL = re.compile(
    r"(https?://[^\s,;()]+|www\.[^\s,;()]+|\b[\w-]+(\.[\w-]+)*\.[a-z]{2,}(/[^\s,;()]*)?)"
)


def text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return re.sub(r"\s+", " ", str(value)).strip()


def drop_emails(value: str) -> str:
    out = EMAIL.sub("", value)
    out = re.sub(r"\s*[,;/]\s*([,;/]\s*)*$", "", re.sub(r"^\s*[,;/]\s*", "", out)).strip()
    return "" if not re.search(r"\w", out) else out


def url_in(value: str) -> str:
    """First web address in the text that is not part of an email address."""
    for m in URL.finditer(EMAIL.sub(" ", value)):
        url = m.group(0).rstrip(".…")
        if "." not in url or url.endswith("…"):
            continue
        return url if url.startswith("http") else f"https://{url}"
    return ""


def founder_tags(*texts: str) -> list[str]:
    joined = " ".join(texts)
    tags = []
    if FEMALE_FOUNDERS.search(joined):
        tags.append(FEMALE_TAG)
    if MINORITY_FOUNDERS.search(joined):
        tags.append(MINORITY_TAG)
    return tags


def cut_note(*values: str) -> str:
    return "some text is cut off in the PDF print" if any(v.endswith("…") for v in values) else ""


def whole_parts(location: str) -> str:
    """A location the print cut off keeps only its whole comma-separated parts:
    "Boston, Massachusetts, Uni…" -> "Boston, Massachusetts"; "San Fra…" -> ""."""
    if not location.endswith("…"):
        return location
    return ", ".join(p.strip() for p in location[:-1].split(",")[:-1])


def bare_linkedin(url: str) -> str:
    """A LinkedIn address without its tracking query ("?trk=..."), with a scheme."""
    if "linkedin.com/" not in url:
        return ""
    url = url.split("?")[0]
    return url if url.startswith("http") else f"https://{url}"


def join(parts: Iterable[str], sep: str = "; ") -> str:
    return sep.join(p for p in parts if p)


# --- Airtable PDF prints ---------------------------------------------------------------
# Airtable prints a wide grid as column blocks: every block lists all rows by their "#",
# so rows are rebuilt by joining the blocks on "#".


def airtable_rows(path: Path) -> dict[int, dict[str, str]]:
    rows: dict[int, dict[str, str]] = {}
    header: list[str] | None = None
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for raw in table:
                    cells = [c or "" for c in raw]
                    if cells and cells[0].strip() == "#":
                        header = [text(c) for c in cells]
                        continue
                    if header is None or not cells[0].strip().isdigit():
                        continue
                    row = rows.setdefault(int(cells[0]), {})
                    for col, cell in zip(header[1:], cells[1:], strict=False):
                        # Wrapped web addresses rejoin without a space.
                        joiner = "" if col in ("Website", "Email", "Your email") else " "
                        row[col] = text(joiner.join(cell.splitlines()))
    return rows


# --- New York seed VCs ("VC Lists (1).xlsx") -------------------------------------------


def nyc_seed_vcs(path: Path) -> list[ListedRow]:
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    out = []
    for raw in ws.iter_rows(values_only=True):
        c = [text(v) for v in raw] + [""] * 10
        if not c[0]:
            continue
        # c[4] ("checked") has no header and no stated meaning; c[6] and c[9] are
        # contacts (emails dropped; a web address in c[6] is the firm's site).
        themes = c[7]
        about = join(
            [
                c[5],
                f"themes: {themes}" if themes else "",
                f"traction asked for: {c[8]}" if c[8] else "",
            ]
        )
        out.append(
            ListedRow(
                name=c[0],
                stages_as_listed=c[1],
                location_as_listed=c[2],
                focus_as_listed=c[3],
                about_as_listed=about,
                website=url_in(c[6]),
                tags=join(founder_tags(c[3], c[5], themes)),
            )
        )
    return out


# --- "The Ultimate List of 750+ Seed Funds" (Matt Estes; "Untitled spreadsheet.xlsx") ---


def money_m(value: str) -> str:
    v = value.replace("$", "").replace(",", "").strip()
    try:
        return f"${float(v):,.1f}M".replace(".0M", "M")
    except ValueError:
        return value


def estes_seed_funds(path: Path) -> list[ListedRow]:
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = [[text(v) for v in r] for r in ws.iter_rows(values_only=True)]
    h = next(i for i, r in enumerate(rows) if len(r) > 2 and r[2] == "Firm")
    header = rows[h]

    def col(name: str) -> int:
        return header.index(name)  # first match: the side table repeats "State"

    first_cat = col("Total Fund Raised ($M)") + 3  # after "# of Investments", "# of Exits"
    out = []
    for r in rows[h + 1 :]:
        r = r + [""] * (len(header) - len(r))
        name = r[col("Firm")]
        if not name:
            continue
        stages = [
            label
            for key, label in (
                ("Seed", "Seed"),
                ("Early Vent.", "Early venture"),
                ("Late Vent.", "Late venture"),
            )
            if r[col(key)]
        ]
        cats = [
            (r[i], r[i + 1]) for i in range(first_cat, first_cat + 10, 2) if r[i] and r[i] != "#"
        ]
        funds, raised = r[col("# of Funds")], r[col("Total Fund Raised ($M)")]
        check = ""
        if raised:
            check = f"total raised {money_m(raised)}"
            if funds:
                check += f" across {funds} fund{'s' if funds != '1' else ''}"
        counts = join(
            [
                f"{r[col('# of Investments')]} investments" if r[col("# of Investments")] else "",
                f"{r[col('# of Exits')]} exits" if r[col("# of Exits")] else "",
            ],
            ", ",
        )
        by_cat = ", ".join(f"{c} {n}" for c, n in cats if n)
        out.append(
            ListedRow(
                name=name,
                stages_as_listed=", ".join(stages),
                location_as_listed=join([r[col("City")], r[col("State")]], ", "),
                focus_as_listed=", ".join(c for c, _ in cats),
                check_as_listed=check,
                about_as_listed=join(
                    [counts, f"investments by category: {by_cat}" if by_cat else ""]
                ),
                website=url_in(r[col("Website")]),
                linkedin=bare_linkedin(r[col("LinkedIn URL")]),
                tags=join(founder_tags(*(c for c, _ in cats))),
            )
        )
    return out


# --- DocSend's early-stage investor list (Airtable print, 2020-21) ----------------------


def docsend_early_investors(path: Path) -> list[ListedRow]:
    out = []
    for _, r in sorted(airtable_rows(path).items()):
        name = r.get("VC Firm", "")
        if not name or name.startswith("*"):  # the list's own disclaimer rows
            continue
        modified = re.search(r"\b(20\d\d)\b", r.get("Last Modified", ""))
        when = modified.group(1) if modified else "2020-21"
        status = join(
            [
                f"new meetings ({when}): {r['New meetings?']}" if r.get("New meetings?") else "",
                f"new term sheets ({when}): {r['New terms sheets?']}"
                if r.get("New terms sheets?")
                else "",
                f"leads or co-invests: {r['Lead/Co-invest']}" if r.get("Lead/Co-invest") else "",
                r.get("Notes", ""),
            ]
        )
        areas = r.get("Areas of Interest", "")
        shown = [r.get("Stage", ""), areas, r.get("Check Size", ""), status]
        out.append(
            ListedRow(
                name=name,
                stages_as_listed=shown[0],
                location_as_listed=whole_parts(r.get("Location", "")),
                focus_as_listed=areas,
                check_as_listed=shown[2],
                about_as_listed=status,
                tags=join(founder_tags(areas, r.get("Notes", ""))),
                note=cut_note(*shown),
            )
        )
    return out


# --- Australia and New Zealand investors (Airtable print) -------------------------------


def australia_nz_investors(path: Path) -> list[ListedRow]:
    out = []
    for _, r in sorted(airtable_rows(path).items()):
        name = r.get("Name", "")
        if not name:
            continue
        fund = r.get("Current fund ($m)", "")
        closed = r.get("Year fund closed", "")
        check = join(
            [
                f"cheque size: {r['Cheque size']}" if r.get("Cheque size") else "",
                f"current fund: {fund}" if fund else "",
                f"fund closed: {closed}" if closed and closed != fund else "",
            ]
        )
        about = join(
            [
                f"other offices: {r['Other Offices']}" if r.get("Other Offices") else "",
                f"leads deals: {r['Lead deals?']}" if r.get("Lead deals?") else "",
                f"currently investing: {r['Currently investing?']}"
                if r.get("Currently investing?")
                else "",
            ]
        )
        sectors = r.get("Sector Focus", "")
        out.append(
            ListedRow(
                name=name,
                type_as_listed=r.get("Type", ""),
                stages_as_listed=r.get("Stage Focus", ""),
                location_as_listed=whole_parts(r.get("Headquarters", "")),
                focus_as_listed=sectors,
                check_as_listed=check,
                about_as_listed=about,
                website=url_in(r.get("Website", "")),
                tags=join(founder_tags(sectors)),
                note=cut_note(r.get("Stage Focus", ""), sectors, check, about),
            )
        )
    return out


# --- US angel investors ("Grid view.csv") ------------------------------------------------


def us_angels(path: Path) -> list[ListedRow]:
    out = []
    with path.open(encoding="utf-8-sig", newline="") as fh:
        for r in csv.DictReader(fh):
            name = text(f"{r['First Name']} {r['Last Name']}")
            if not name:
                continue
            title, company, industry = text(r["Title"]), text(r["Company"]), text(r["Industry"])
            role = join([title, company], " at ") if title else company
            out.append(
                ListedRow(
                    name=name,
                    location_as_listed=join([text(r["City"]), text(r["State"])], ", "),
                    # The person's day job, and that company's industry: not an
                    # investment focus.
                    about_as_listed=join(
                        [role, f"company industry: {industry}" if industry else ""]
                    ),
                    linkedin=bare_linkedin(text(r["Person Linkedin Url"])),
                )
            )
    return out


# --- Writing -------------------------------------------------------------------------------

# Names shortened to the firm's own name. The cut-off ones keep only the visible text,
# finishing a word only where a letter or two is missing ("Opportunitie…").
RENAMES = {
    "Open Prairie Rural Opportunitie…": (
        "Open Prairie Rural Opportunities",
        "name cut off in the PDF print",
    ),
    "Equation Angels | Southwestern …": ("Equation Angels", "name cut off in the PDF print"),
    "Northwestern Mutual Future Ve…": (
        "Northwestern Mutual Future Ventures",
        "name cut off in the PDF print",
    ),
    "NZ Growth Capital Partners (Elevate + Aspire funds)": (
        "NZ Growth Capital Partners",
        "listed with its Elevate and Aspire funds",
    ),
    # Canberra's fund; "Activate Capital" (US) is a different firm, and names that
    # differ only in capitals cannot be kept apart, so the list's HQ city is added.
    "ACTivate Capital": (
        "ACTivate Capital (Canberra)",
        "HQ city added to tell it apart from Activate Capital (US)",
    ),
    "TORUS (previously known as Palm Beach Ventures)": (
        "TORUS",
        "listed as previously known as Palm Beach Ventures",
    ),
}

LISTS = {
    "nyc_seed_vc_list_2026-11-12.csv": (nyc_seed_vcs, "nyc_seed_vc_list.xlsx"),
    "estes_750_seed_funds_2026-11-12.csv": (estes_seed_funds, "estes_750_seed_funds.xlsx"),
    "docsend_early_investors_2026-11-12.csv": (
        docsend_early_investors,
        "docsend_early_investors_airtable.pdf",
    ),
    "australia_nz_investors_2026-11-12.csv": (
        australia_nz_investors,
        "australia_nz_investors_airtable.pdf",
    ),
    "us_angel_investors_2026-11-12.csv": (us_angels, "us_angel_investors_grid_view.csv"),
}


def finish(row: ListedRow) -> ListedRow:
    """Apply `RENAMES`; no email address survives into a seed file, whichever column it
    sat in."""
    if row.name in RENAMES:
        name, why = RENAMES[row.name]
        row = ListedRow(
            **{
                **asdict(row),
                "name": name,
                "name_as_listed": row.name,
                "note": join([why, row.note]),
            }
        )
    return ListedRow(**{k: drop_emails(v) for k, v in asdict(row).items()})


def write(path: Path, rows: list[ListedRow]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        for row in rows:
            w.writerow(asdict(finish(row)))


def main(raw: Path = RAW_SOURCES, seed: Path = SEED_DIR) -> dict[str, int]:
    counts = {}
    for out_name, (read, raw_name) in LISTS.items():
        rows = read(raw / raw_name)
        write(seed / out_name, rows)
        counts[out_name] = len(rows)
    return counts


if __name__ == "__main__":
    for name, n in main().items():
        print(f"{name:<45} {n:>5}")
