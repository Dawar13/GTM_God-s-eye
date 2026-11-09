"""Target customers from the user's workbooks in data/raw/customers/ (config.CUSTOMER_WORKBOOKS):
Mumbai–Pune and Bengaluru (prepared 2026-10-15, handed over with the Phase 0 sources) and
Hyderabad (prepared 2026-11-09, received the same day).

Rows are kept as listed: name, tier, category, the revenue and team-size cells, the short
address, and where a list has them, the archetype number, sub-segment, what the company
makes, why it fits and the size basis. Columns are found by header name, so sheets that
order them differently or add columns still read. The lists' own notes say the sizes are
approximate or estimated, so every record is low confidence. Derived fields:

- revenue_band / team_band: the band a cell starts with ('500–2,000 (est.)' -> 500_2000);
  'Not public' and anything else unreadable is null;
- archetype_fit: from the sheet (the Hyderabad Targets sheet is high fit, Adjacent medium);
- sectors: the category mapped to fixed industry groups (config.CUSTOMER_CATEGORY_SECTORS);
- areas: the place names in the address mapped to areas (config.CUSTOMER_PLACES);
- links: the same company on another list, and competitors whose public customer lists
  name it, both by exact name key (legal words such as Ltd and India dropped, so
  "Bosch Ltd" matches a competitor's "Bosch"). There is no fuzzy matching.
"""

import re
from pathlib import Path

from openpyxl import load_workbook
from slugify import slugify

from atlas.config import (
    CUSTOMER_AREAS,
    CUSTOMER_CATEGORY_SECTORS,
    CUSTOMER_PLACES,
    CUSTOMER_REVENUE_BANDS,
    CUSTOMER_TEAM_BANDS,
    CUSTOMER_WORKBOOKS,
    CUSTOMERS_DIR,
)
from atlas.model import Store, source

# Header prefix (lower case) -> field. Checked in order, so "archetype #" (the number column)
# is taken before "archetype (" (the Adjacent sheet's category column).
COLUMNS = (
    ("tier", "tier"),
    ("company", "name"),
    ("category", "category"),
    ("archetype #", "archetype"),
    ("archetype (", "category"),
    ("revenue band", "revenue"),
    ("team size band", "team"),
    ("address", "address"),
    ("sub-segment", "sub_segment"),
    ("what they make", "what_they_make"),
    ("why a fit", "why_fit"),
    ("why it is here", "why_fit"),
    ("size basis", "size_basis"),
)
REQUIRED = ("tier", "name", "category", "revenue", "team", "address")
SOURCE_IDS = {
    "mumbai_pune": "customer_list_mumbai_pune_2026_10_15",
    "bengaluru": "customer_list_bengaluru_2026_10_15",
    "hyderabad": "customer_list_hyderabad_2026_11_09",
}
SLUG_PREFIX = {"mumbai_pune": "mp", "bengaluru": "blr", "hyderabad": "hyd"}

# Dropped for name keys only: legal form and country words that differ between a group and
# its Indian company ("Siemens" / "Siemens Ltd", "Whirlpool" / "Whirlpool of India").
_KEY_DROP = frozenset(
    {"ltd", "limited", "pvt", "private", "india", "of", "the", "co", "company", "inc", "corp"}
)

_PLACE_RE = re.compile(
    r"\b(" + "|".join(re.escape(p) for p in sorted(CUSTOMER_PLACES, key=len, reverse=True)) + r")\b"
)
_ARCHETYPE_PREFIX = re.compile(r"^(\d{2})\s+")


class CustomerListError(ValueError):
    pass


def name_key(name: str) -> str:
    """Lower case, '&' as 'and', no brackets, nothing after a comma (the Hyderabad list names
    a site there: 'Mahindra & Mahindra, Zaheerabad'), no legal or country words."""
    s = name.lower().replace("&", " and ")
    s = re.sub(r"\([^)]*\)", " ", s)
    s = s.split(",")[0]
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(w for w in s.split() if w not in _KEY_DROP)


def band(text: str | None, allowed: tuple[str, ...]) -> str | None:
    """'<100' -> 'lt_100', '500–2,000 (est.)' -> '500_2000', '>50,000' -> 'gt_50000'; else None."""
    if text is None:
        return None
    s = re.sub(r"\(.*$", "", str(text)).strip()
    s = s.replace(",", "").replace("–", "-").replace("—", "-").replace(" ", "")
    if s.startswith("<"):
        key = f"lt_{s[1:]}"
    elif s.startswith(">"):
        key = f"gt_{s[1:]}"
    else:
        key = s.replace("-", "_")
    return key if key in allowed else None


def areas(address: str | None) -> list[str]:
    if not address:
        return []
    found = {CUSTOMER_PLACES[m.group(1)] for m in _PLACE_RE.finditer(address.lower())}
    return [a for a in CUSTOMER_AREAS if a in found]


def sectors(category: str) -> list[str]:
    groups = CUSTOMER_CATEGORY_SECTORS.get(category.strip().lower())
    if groups is None:
        raise CustomerListError(
            f"category {category!r} has no industry group; add it to CUSTOMER_CATEGORY_SECTORS"
        )
    return list(groups)


def tier(text: str) -> int:
    m = re.fullmatch(r"tier\s*([123])", str(text).strip().lower())
    if not m:
        raise CustomerListError(f"tier {text!r} is not Tier 1, 2 or 3")
    return int(m.group(1))


def _text(value: object) -> str | None:
    s = str(value).strip() if value is not None else ""
    return s or None


def _columns(header: list[str], where: str) -> dict[str, int]:
    found: dict[str, int] = {}
    for i, cell in enumerate(header):
        for prefix, field in COLUMNS:
            if cell.startswith(prefix):
                found.setdefault(field, i)
                break
    missing = [f for f in REQUIRED if f not in found]
    if missing:
        raise CustomerListError(f"{where}: no column for {', '.join(missing)}")
    return found


def read_rows(path: Path, sheet: str) -> list[dict]:
    ws = load_workbook(path, read_only=True, data_only=True)[sheet]
    rows = ws.iter_rows(values_only=True)
    cols = _columns([(_text(c) or "").lower() for c in next(rows)], f"{path.name} / {sheet}")
    out = []
    for row in rows:
        cells = {f: _text(row[i]) if i < len(row) else None for f, i in cols.items()}
        if not any(cells.values()):
            continue
        if not (cells["tier"] and cells["name"] and cells["category"]):
            raise CustomerListError(
                f"{path.name} / {sheet}: row {cells} lacks a tier, company or category"
            )
        # The Adjacent sheet writes the archetype number before its name ("04 Steel and ...").
        m = _ARCHETYPE_PREFIX.match(cells["category"])
        if m:
            cells["category"] = cells["category"][m.end() :]
            cells["archetype"] = cells.get("archetype") or m.group(1)
        out.append(cells)
    return out


def build(store: Store, directory: Path = CUSTOMERS_DIR) -> list[dict]:
    records: list[dict] = []
    used: set[str] = set()
    for list_key, (filename, received, sheets) in CUSTOMER_WORKBOOKS.items():
        src = source(
            f"user_supplied:{SOURCE_IDS[list_key]}",
            "user_supplied",
            title=filename,
            retrieved_at=received,
        )
        for sheet, fit in sheets:
            for row in read_rows(directory / filename, sheet):
                base = f"cust_{SLUG_PREFIX[list_key]}-{slugify(row['name'])}"
                rid, n = base, 2
                while rid in used:
                    rid, n = f"{base}-{n}", n + 1
                used.add(rid)
                archetype = row.get("archetype")
                records.append(
                    {
                        "id": rid,
                        "name": row["name"],
                        "list": list_key,
                        "tier": tier(row["tier"]),
                        "category": row["category"],
                        "sectors": sectors(row["category"]),
                        "revenue_band": band(row["revenue"], CUSTOMER_REVENUE_BANDS),
                        "team_band": band(row["team"], CUSTOMER_TEAM_BANDS),
                        "revenue_as_listed": row["revenue"],
                        "team_as_listed": row["team"],
                        "size_basis": row.get("size_basis"),
                        "archetype": archetype.zfill(2) if archetype else None,
                        "archetype_fit": fit,
                        "sub_segment": row.get("sub_segment"),
                        "what_they_make": row.get("what_they_make"),
                        "why_fit": row.get("why_fit"),
                        "address": row["address"],
                        "areas": areas(row["address"]),
                        "also_listed_ids": [],
                        "competitor_ids": [],
                        "sources": [src],
                        "confidence": "low",
                    }
                )

    by_key: dict[str, list[dict]] = {}
    for rec in records:
        by_key.setdefault(name_key(rec["name"]), []).append(rec)
    for rec in records:
        rec["also_listed_ids"] = [
            o["id"] for o in by_key[name_key(rec["name"])] if o["list"] != rec["list"]
        ]

    for comp in store.competitors.values():
        for named in comp.get("named_customers") or []:
            key = name_key(named)
            for rec in by_key.get(key, []) if key else []:
                if comp["id"] not in rec["competitor_ids"]:
                    rec["competitor_ids"].append(comp["id"])
    for rec in records:
        rec["competitor_ids"].sort()
    return records
