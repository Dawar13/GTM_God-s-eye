"""Physical-AI landscape companies from four user-supplied lists:

- the market map image (data/seed/physical_ai_market_map_2026-11-01.csv),
- the YC physical-AI LinkedIn post (data/seed/yc_physical_ai_2026-11-01.csv),
- the "San Francisco's Robotics & Industrial AI" post, 108 names grouped by stage
  (data/seed/sf_robotics_industrial_ai_2026-11-11.csv),
- "The Robotics Market Map Q4 2026" (data from Crustdata): 189 names by segment and
  founding period, as the map's captions show them; the ten its post calls worth
  watching carry the post's full name, one-liner and founders
  (data/seed/robotics_market_map_q4_2026_2026-11-12.csv).

These are context, not competitors: they never enter companies/competitors. A
name that appears on several lists becomes one record carrying all of them. A
record links to an existing company or competitor only when its name key equals
exactly one record's key; there is no fuzzy matching. Segments, stage labels,
founding periods, batch labels, one-liners and founders are the lists' own words,
unverified.
"""

import csv
from pathlib import Path

from slugify import slugify

from atlas import names
from atlas.config import (
    LANDSCAPE_MAP_CSV,
    LANDSCAPE_ROBOTICS_MAP_CSV,
    LANDSCAPE_SF_CSV,
    LANDSCAPE_YC_CSV,
)
from atlas.model import Store, source

MAP_SOURCE = ("physical_ai_market_map_2026_11_01", "2026-11-01")
YC_SOURCE = ("yc_physical_ai_list_2026_11_01", "2026-11-01")
SF_SOURCE = ("sf_robotics_industrial_ai_post_2026_11_11", "2026-11-11")
ROBOTICS_MAP_SOURCE = ("robotics_market_map_q4_2026_crustdata_2026_11_12", "2026-11-12")

# A note starting with this keeps a name unlinked even on a unique exact match: the
# post's name alone does not show it is the record of the same name.
NOT_LINKED = "not linked:"


def _key(name: str) -> str:
    return names.match_key(names.investing_name(name).name)


def _company_index(store: Store) -> dict[str, set[str]]:
    by_key: dict[str, set[str]] = {}
    for rec in [*store.companies.values(), *store.competitors.values()]:
        by_key.setdefault(_key(rec["name"]), set()).add(rec["id"])
    return by_key


def _src(spec: tuple[str, str]) -> dict:
    source_id, received = spec
    return source(
        f"user_supplied:{source_id}", "user_supplied", title=source_id, retrieved_at=received
    )


def _blank(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _add_note(rec: dict, note: str | None) -> None:
    if note and note not in (rec["note"] or ""):
        rec["note"] = f"{rec['note']}; {note}" if rec["note"] else note


def _blocks_link(note: str | None) -> bool:
    # A name read off a logo ("Origin", "sde") is too thin to link: the map's Indian
    # "Origin" matched a US company of the same name.
    text = (note or "").lower()
    return "logo" in text or any(p.strip().startswith(NOT_LINKED) for p in text.split(";"))


def build(
    store: Store,
    map_path: Path = LANDSCAPE_MAP_CSV,
    yc_path: Path = LANDSCAPE_YC_CSV,
    sf_path: Path = LANDSCAPE_SF_CSV,
    robotics_map_path: Path = LANDSCAPE_ROBOTICS_MAP_CSV,
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
                "stage_as_listed": None,
                "robotics_map_segment": None,
                "founded_as_listed": None,
                "description_as_listed": None,
                "founders_as_listed": [],
                "note": None,
                "matched_id": None,
                "sources": [],
                "confidence": "low",
            }
        return records[key]

    def rows(path: Path):
        with path.open(encoding="utf-8", newline="") as fh:
            yield from csv.DictReader(fh)

    for row in rows(map_path):
        rec = get(row["name"])
        rec["lists"].append("market_map")
        rec["segment"] = _blank(row["segment"])
        rec["region"] = _blank(row["region"])
        _add_note(rec, _blank(row["note"]))
        rec["sources"].append(_src(MAP_SOURCE))
    for row in rows(yc_path):
        rec = get(row["name"])
        rec["lists"].append("yc_physical_ai")
        rec["yc_batch"] = _blank(row["yc_batch"])
        rec["description_as_listed"] = rec["description_as_listed"] or _blank(
            row["description_as_listed"]
        )
        rec["sources"].append(_src(YC_SOURCE))
    for row in rows(sf_path):
        rec = get(row["name"])
        rec["lists"].append("sf_robotics_industrial_ai")
        rec["stage_as_listed"] = _blank(row["stage_as_listed"])
        _add_note(rec, _blank(row["note"]))
        rec["sources"].append(_src(SF_SOURCE))
    for row in rows(robotics_map_path):
        rec = get(row["name"])
        rec["lists"].append("robotics_market_map")
        rec["robotics_map_segment"] = _blank(row["segment"])
        rec["founded_as_listed"] = _blank(row["founded_as_listed"])
        rec["description_as_listed"] = rec["description_as_listed"] or _blank(
            row["description_as_listed"]
        )
        rec["founders_as_listed"] = [
            f for f in (p.strip() for p in (row["founders_as_listed"] or "").split("+")) if f
        ]
        _add_note(rec, _blank(row["note"]))
        rec["sources"].append(_src(ROBOTICS_MAP_SOURCE))

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
        linkable = len(matches) == 1 and not _blocks_link(rec["note"])
        rec["matched_id"] = next(iter(matches)) if linkable else None
    return list(records.values())
