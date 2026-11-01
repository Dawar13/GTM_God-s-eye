"""Physical-AI landscape companies from two user-supplied lists (received 2026-11-01):
the market map image (data/seed/physical_ai_market_map_2026-11-01.csv) and the
YC physical-AI LinkedIn post (data/seed/yc_physical_ai_2026-11-01.csv).

These are context, not competitors: they never enter companies/competitors. A
name that appears on both lists becomes one record carrying both. A record links
to an existing company or competitor only when its name key equals exactly one
record's key; there is no fuzzy matching. Batch labels and one-liners are the
post's own words, unverified.
"""

import csv
from pathlib import Path

from slugify import slugify

from atlas import names
from atlas.config import LANDSCAPE_MAP_CSV, LANDSCAPE_YC_CSV
from atlas.model import Store, source

MAP_SOURCE_ID = "physical_ai_market_map_2026_11_01"
YC_SOURCE_ID = "yc_physical_ai_list_2026_11_01"
RECEIVED = "2026-11-01"


def _key(name: str) -> str:
    return names.match_key(names.investing_name(name).name)


def _company_index(store: Store) -> dict[str, set[str]]:
    by_key: dict[str, set[str]] = {}
    for rec in [*store.companies.values(), *store.competitors.values()]:
        by_key.setdefault(_key(rec["name"]), set()).add(rec["id"])
    return by_key


def _src(source_id: str) -> dict:
    return source(
        f"user_supplied:{source_id}", "user_supplied", title=source_id, retrieved_at=RECEIVED
    )


def _blank(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def build(
    store: Store, map_path: Path = LANDSCAPE_MAP_CSV, yc_path: Path = LANDSCAPE_YC_CSV
) -> list[dict]:
    by_key = _company_index(store)
    records: dict[str, dict] = {}  # name key -> record, in first-seen order

    def get(name: str) -> dict:
        key = _key(name) or name.strip().lower()
        if key not in records:
            records[key] = {
                "id": "",
                "name": name.strip(),
                "lists": [],
                "segment": None,
                "region": None,
                "yc_batch": None,
                "description_as_listed": None,
                "note": None,
                "matched_id": None,
                "sources": [],
                "confidence": "low",
            }
        return records[key]

    with map_path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            rec = get(row["name"])
            rec["lists"].append("market_map")
            rec["segment"] = _blank(row["segment"])
            rec["region"] = _blank(row["region"])
            rec["note"] = _blank(row["note"])
            rec["sources"].append(_src(MAP_SOURCE_ID))
    with yc_path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            rec = get(row["name"])
            rec["lists"].append("yc_physical_ai")
            rec["yc_batch"] = _blank(row["yc_batch"])
            rec["description_as_listed"] = _blank(row["description_as_listed"])
            rec["sources"].append(_src(YC_SOURCE_ID))

    used: set[str] = set()
    for key, rec in records.items():
        base = f"land_{slugify(rec['name'])}"
        rec["id"], n = base, 2
        while rec["id"] in used:
            rec["id"], n = f"{base}-{n}", n + 1
        used.add(rec["id"])
        rec["lists"] = list(dict.fromkeys(rec["lists"]))
        rec["sources"] = list({s["url"]: s for s in rec["sources"]}.values())
        matches = by_key.get(key, set())
        # A name read off a logo ("Origin", "sde") is too thin to link: the map's Indian
        # "Origin" matched a US company of the same name.
        from_logo = "logo" in (rec.get("note") or "").lower()
        rec["matched_id"] = next(iter(matches)) if len(matches) == 1 and not from_logo else None
    return list(records.values())
