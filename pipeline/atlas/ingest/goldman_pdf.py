"""Shai Goldman's list of VC funds of $200M or less (goldman_sub200m_funds).

Columns: index, fund name, amount ($M), date announced, year, fund number,
location, notes/link. Table extraction is tried first; pages where it finds no
indexed rows fall back to line parsing anchored on the leading index.

Anomalies are flagged, not fixed (PHASE_0 §6.3). Where a value is unusable the
field is left null and the anomaly says so.
"""

import csv
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import pdfplumber

from atlas.config import GOLDMAN_PDF, INTERIM
from atlas.names import clean, typo_tokens

SOURCE_ID = "goldman_sub200m_funds"

LIST_CEILING_MUSD = 200
IMPLAUSIBLE_MUSD = 1000
MIN_YEAR = 2000
REFERENCE_DATE = date(2026, 10, 29)

ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X"}

# Notes that say the amount is a target, a first close or a guess.
NOT_FINAL_RE = re.compile(
    r"(?i)\btarget|\braising\b|\b(?:1st|first) close|not closed|unconfirmed|assumption|"
    r"\blikely\b|not disclosed|unclear|has closed yet"
)
URL_RE = re.compile(r"https?://\S+")
BARE_DOMAIN_RE = re.compile(r"^(?:www\.)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:/\S*)?$")
LINE_RE = re.compile(
    r"^(?P<idx>\d{1,4})(?P<name>\D.*?)\s+\$(?P<amount>[\d,.]+)\s+(?P<date>\S+)\s+(?P<year>\d{4})"
    r"(?:\s+(?P<number>[IVXLC]+))?(?:\s+(?P<rest>.*))?$"
)


@dataclass
class RawRow:
    row_ref: str
    row_index: int | None
    cells: list[str]  # name, amount, date, year, number, location, notes


@dataclass
class Anomaly:
    row_ref: str
    field: str
    raw_value: str | None
    reason: str
    resolution: str | None


@dataclass
class GoldmanFund:
    row_ref: str
    row_index: int | None
    fund_name_raw: str
    fund_name: str
    amount_musd: float | None
    date_raw: str
    date_iso: str | None
    date_precision: str | None
    year: int | None
    fund_number: str | None
    location: str | None
    link: str | None
    notes: str | None
    confidence: str = "medium"
    anomalies: list[Anomaly] = field(default_factory=list)

    @property
    def size_usd(self) -> float | None:
        return None if self.amount_musd is None else round(self.amount_musd * 1_000_000)


# --- extraction ---------------------------------------------------------------------------


def _unwrap_urls(text: str) -> str:
    """Re-join links the PDF wrapped onto a new line inside a cell."""
    pattern = re.compile(r"(https?://\S+)\n(\S)")
    while pattern.search(text):
        text = pattern.sub(r"\1\2", text)
    return text


def _from_table_row(cells: list[str | None]) -> RawRow | None:
    vals = [clean(c or "") if i < 7 else (c or "") for i, c in enumerate(cells)]
    while len(vals) < 9:
        vals.append("")
    idx, name, amount, date_raw, year, number, location = vals[:7]
    # Long links overflow into a ninth cell; it continues the URL, so join without a space.
    notes = (cells[7] or "") + (cells[8] or "") if len(cells) > 8 else (cells[7] or "")
    notes = clean(_unwrap_urls(notes))
    if idx.isdigit():
        return RawRow(idx, int(idx), [name, amount, date_raw, year, number, location, notes])
    # A few rows were added above row 1 without an index. Keep real fund rows
    # (name plus a four-digit year), skip headers and the summary tables.
    if name and name != "Fund Name" and re.fullmatch(r"\d{4}", year):
        return RawRow("", None, [name, amount, date_raw, year, number, location, notes])
    return None


def _from_text_line(line: str) -> RawRow | None:
    m = LINE_RE.match(line.strip())
    if not m:
        return None
    rest = m.group("rest") or ""
    link = URL_RE.search(rest)
    location = clean(rest[: link.start()] if link else rest)
    notes = link.group(0) if link else ""
    return RawRow(
        m.group("idx"),
        int(m.group("idx")),
        [
            clean(m.group("name")),
            "$" + m.group("amount"),
            m.group("date"),
            m.group("year"),
            m.group("number") or "",
            location,
            notes,
        ],
    )


def extract_rows(pdf_path: Path = GOLDMAN_PDF) -> tuple[list[RawRow], list[str]]:
    """All fund rows in page order, and a note per page that needed the text fallback."""
    rows: list[RawRow] = []
    fallbacks: list[str] = []
    unindexed = 0
    with pdfplumber.open(pdf_path) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            page_rows = [
                r
                for table in page.extract_tables()
                for cells in table
                if (r := _from_table_row(cells)) is not None
            ]
            if not any(r.row_index for r in page_rows):
                text_rows = [
                    r
                    for line in (page.extract_text() or "").splitlines()
                    if (r := _from_text_line(line)) is not None
                ]
                if text_rows:
                    fallbacks.append(f"page {page_no}: {len(text_rows)} rows from text")
                    page_rows = text_rows
            for r in page_rows:
                if r.row_index is None:
                    unindexed += 1
                    r.row_ref = f"unindexed-{unindexed}"
                rows.append(r)
    return rows, fallbacks


# --- parsing ------------------------------------------------------------------------------


def _parse_amount(raw: str, flag) -> float | None:
    if not raw:
        flag("amount", raw, "no amount listed", "size left null")
        return None
    m = re.fullmatch(r"\$?\s*([\d,]+(?:\.\d+)?)", raw)
    if not m:
        flag("amount", raw, "amount is not a number", "size left null")
        return None
    value = float(m.group(1).replace(",", ""))
    if value > IMPLAUSIBLE_MUSD:
        flag(
            "amount",
            raw,
            f"implausible for a list of funds ≤ ${LIST_CEILING_MUSD}M",
            "size left null",
        )
        return None
    if value > LIST_CEILING_MUSD:
        flag("amount", raw, f"above the list's ${LIST_CEILING_MUSD}M ceiling", "kept as listed")
    return value


def _parse_year(raw: str, flag) -> int | None:
    if re.fullmatch(r"\d{4}", raw) and MIN_YEAR <= int(raw) <= REFERENCE_DATE.year:
        return int(raw)
    flag("year", raw, "year column missing or out of range", "vintage left null")
    return None


def _parse_date(raw: str, year: int | None, flag) -> tuple[str | None, str | None]:
    """ISO partial date and its precision. Falls back to the year column when broken."""
    fallback = (str(year), "year") if year else (None, None)
    resolution = f"used year column ({year})" if year else "date left null"
    if not raw:
        flag("date", raw, "no date listed", resolution)
        return fallback
    m = re.fullmatch(r"(\d{1,2})/(?:(\d{1,2})/)?(\d{4})", raw)
    if not m:
        flag("date", raw, "date is malformed", resolution)
        return fallback
    month, day, yr = int(m.group(1)), int(m.group(2) or 1), int(m.group(3))
    try:
        parsed = date(yr, month, day)
    except ValueError:
        flag("date", raw, "date does not exist", resolution)
        return fallback
    if yr < MIN_YEAR:
        flag("date", raw, f"year {yr} is before {MIN_YEAR}", resolution)
        return fallback
    if parsed > REFERENCE_DATE:
        flag("date", raw, "date is in the future", resolution)
        return fallback
    if year and yr != year:
        flag("year", str(year), f"year column disagrees with date {raw}", "kept both as listed")
    if m.group(2):
        return parsed.isoformat(), "day"
    return f"{yr:04d}-{month:02d}", "month"


def _parse_number(raw: str, flag) -> tuple[str | None, str | None]:
    """Roman fund number, plus a note when the cell held something else."""
    if not raw:
        return None, None
    if re.fullmatch(r"[IVXLC]+", raw):
        return raw, None
    if raw.isdigit() and int(raw) in ROMAN:
        flag("fund_number", raw, "Arabic numeral", f"read as Fund {ROMAN[int(raw)]}")
        return ROMAN[int(raw)], None
    flag("fund_number", raw, "not a fund number", "number left null; text kept in notes")
    return None, f"Fund number listed as '{raw}'"


def _split_notes(raw: str, flag) -> tuple[str | None, str | None]:
    """(link, remaining text)."""
    if not raw:
        return None, None
    m = URL_RE.search(raw)
    if m:
        link = m.group(0).rstrip(").,;")
        text = clean((raw[: m.start()] + " " + raw[m.end() :]).strip(" -–"))
        return link, text or None
    if BARE_DOMAIN_RE.fullmatch(raw):
        flag("notes", raw, "link without a scheme", "read as https://")
        return f"https://{raw}", None
    return None, raw


def parse_row(raw: RawRow) -> GoldmanFund:
    anomalies: list[Anomaly] = []

    def flag(field_name: str, value: str | None, reason: str, resolution: str | None) -> None:
        anomalies.append(Anomaly(raw.row_ref, field_name, value, reason, resolution))

    name_raw, amount_raw, date_raw, year_raw, number_raw, location, notes_raw = raw.cells
    if raw.row_index is None:
        flag("row_index", None, "row has no index number", "kept as an extra row")

    amount = _parse_amount(amount_raw, flag)
    year = _parse_year(year_raw, flag)
    date_iso, precision = _parse_date(date_raw, year, flag)
    number, number_note = _parse_number(number_raw, flag)
    link, notes = _split_notes(notes_raw, flag)
    notes = "; ".join(n for n in (notes, number_note) if n) or None

    for token, likely in typo_tokens(name_raw):
        flag(
            "fund_name",
            name_raw,
            f"possible typo '{token}'",
            f"kept as written; matched as '{likely}'",
        )

    confidence = "medium"
    if notes and NOT_FINAL_RE.search(notes):
        flag("notes", notes, "notes say the amount may not be a final close", "confidence low")
        confidence = "low"

    return GoldmanFund(
        row_ref=raw.row_ref,
        row_index=raw.row_index,
        fund_name_raw=name_raw,
        fund_name=clean(name_raw),
        amount_musd=amount,
        date_raw=date_raw,
        date_iso=date_iso,
        date_precision=precision,
        year=year,
        fund_number=number,
        location=location or None,
        link=link,
        notes=notes,
        confidence=confidence,
        anomalies=anomalies,
    )


def parse_pdf(pdf_path: Path = GOLDMAN_PDF) -> tuple[list[GoldmanFund], list[str]]:
    rows, fallbacks = extract_rows(pdf_path)
    return [parse_row(r) for r in rows], fallbacks


def write_interim(funds: list[GoldmanFund], out_dir: Path = INTERIM) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "goldman_funds.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(
            [
                "row_index",
                "fund_name_raw",
                "amount_musd",
                "date_raw",
                "date_iso",
                "year",
                "fund_number",
                "location",
                "link",
                "notes",
            ]
        )
        for f in funds:
            w.writerow(
                [
                    f.row_ref,
                    f.fund_name_raw,
                    f.amount_musd,
                    f.date_raw,
                    f.date_iso,
                    f.year,
                    f.fund_number,
                    f.location,
                    f.link,
                    f.notes,
                ]
            )
    with (out_dir / "goldman_anomalies.csv").open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["row_index", "fund_name_raw", "field", "raw_value", "reason", "resolution"])
        for f in funds:
            for a in f.anomalies:
                w.writerow(
                    [a.row_ref, f.fund_name_raw, a.field, a.raw_value, a.reason, a.resolution]
                )
