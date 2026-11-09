"""Target customers from the user's two workbooks in data/raw/customers/ (Mumbai–Pune and
Bengaluru, prepared 2026-10-15, handed over with the Phase 0 sources).

Rows are kept as listed: name, tier, category, revenue and team-size bands, and the short
address. The lists' own notes say the bands are approximate, from general knowledge, and
not looked up per company, so every record is low confidence. Three fields are derived:

- sectors: the category mapped to fixed industry groups (config.CUSTOMER_CATEGORY_SECTORS);
- areas: the place names in the address mapped to areas (config.CUSTOMER_PLACES);
- links: the same company on the other list, and competitors whose public customer
  lists name it, both by exact name key (legal words such as Ltd and India dropped, so
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
    USER_SOURCES_RECEIVED,
)
from atlas.model import Store, source

SHEET = "Targets"
HEADERS = ("tier", "company", "category", "revenue band", "team size band", "address")
SOURCE_IDS = {
    "mumbai_pune": "customer_list_mumbai_pune_2026_10_15",
    "bengaluru": "customer_list_bengaluru_2026_10_15",
}
SLUG_PREFIX = {"mumbai_pune": "mp", "bengaluru": "blr"}

# Dropped for name keys only: legal form and country words that differ between a group and
# its Indian company ("Siemens" / "Siemens Ltd", "Whirlpool" / "Whirlpool of India").
_KEY_DROP = frozenset(
    {"ltd", "limited", "pvt", "private", "india", "of", "the", "co", "company", "inc", "corp"}
)

_PLACE_RE = re.compile(
    r"\b(" + "|".join(re.escape(p) for p in sorted(CUSTOMER_PLACES, key=len, reverse=True)) + r")\b"
)


class CustomerListError(ValueError):
    pass


def name_key(name: str) -> str:
    s = name.lower().replace("&", " and ")
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return " ".join(w for w in s.split() if w not in _KEY_DROP)


def band(text: str | None, allowed: tuple[str, ...]) -> str | None:
    """'<100' -> 'lt_100', '500–2,000' -> '500_2000', '>50,000' -> 'gt_50000'; else None."""
    if text is None:
        return None
    s = str(text).strip().replace(",", "").replace("–", "-").replace("—", "-").replace(" ", "")
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


def read_rows(path: Path) -> list[dict]:
    ws = load_workbook(path, read_only=True, data_only=True)[SHEET]
    rows = ws.iter_rows(values_only=True)
    header = [(_text(c) or "").lower() for c in next(rows)]
    for want, got in zip(HEADERS, header, strict=False):
        if not got.startswith(want):
            raise CustomerListError(f"{path.name}: expected a {want!r} column, found {got!r}")
    out = []
    for row in rows:
        cells = [_text(c) for c in row[: len(HEADERS)]]
        if not any(cells):
            continue
        t, name, category, revenue, team, address = cells
        if not (t and name and category):
            raise CustomerListError(f"{path.name}: row {cells} lacks a tier, company or category")
        out.append(
            {
                "tier": t,
                "name": name,
                "category": category,
                "revenue": revenue,
                "team": team,
                "address": address,
            }
        )
    return out


def build(store: Store, directory: Path = CUSTOMERS_DIR) -> list[dict]:
    records: list[dict] = []
    used: set[str] = set()
    for list_key, filename in CUSTOMER_WORKBOOKS.items():
        src = source(
            f"user_supplied:{SOURCE_IDS[list_key]}",
            "user_supplied",
            title=filename,
            retrieved_at=USER_SOURCES_RECEIVED,
        )
        for row in read_rows(directory / filename):
            base = f"cust_{SLUG_PREFIX[list_key]}-{slugify(row['name'])}"
            rid, n = base, 2
            while rid in used:
                rid, n = f"{base}-{n}", n + 1
            used.add(rid)
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
