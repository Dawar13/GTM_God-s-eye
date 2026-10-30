"""Accelerator and residency programmes from a user-supplied list
(data/seed/accelerators_2026.csv, received 2026-10-30).

Terms stay exactly as listed and are unverified; the numeric columns were
transcribed from each terms string. A programme links to an investor only when
the firm it names matches exactly one investor's name or alias key, so a bare
brand never lands on the wrong record.
"""

import csv
from pathlib import Path

from slugify import slugify

from atlas import fx, names
from atlas.config import ACCELERATORS_CSV
from atlas.model import Store, source

SOURCE_ID = "accelerators_2026_list"
RECEIVED = "2026-10-30"
LIST_YEAR = 2026  # FX year for the listed amounts


def _number(raw: str) -> float | int | None:
    raw = raw.strip()
    if not raw:
        return None
    value = float(raw)
    return int(value) if value.is_integer() else value


def _investor_index(store: Store) -> dict[str, set[str]]:
    by_key: dict[str, set[str]] = {}
    for inv in store.investors.values():
        for n in [inv["name"], *inv["aliases"]]:
            by_key.setdefault(names.match_key(n), set()).add(inv["id"])
    return by_key


def build(store: Store, path: Path = ACCELERATORS_CSV) -> list[dict]:
    by_key = _investor_index(store)
    out = []
    with path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            matches = by_key.get(names.match_key(row["firm_as_named"]), set())
            amount = _number(row["headline_amount"])
            currency = row["currency"].strip() or None
            usd, fx_used = fx.to_usd(amount, currency, LIST_YEAR)
            out.append(
                {
                    "id": f"prog_{slugify(row['program'])}",
                    "name": row["program"],
                    "rank_in_list": int(row["rank"]),
                    "investor_id": next(iter(matches)) if len(matches) == 1 else None,
                    "terms_as_listed": row["terms_as_listed"],
                    "headline_amount": amount,
                    "currency": currency,
                    "headline_usd": usd,
                    "upfront_amount": _number(row["upfront_amount"]),
                    "upfront_equity_pct": _number(row["upfront_equity_pct"]),
                    "equity_free": True if row["equity_free"].strip() == "true" else None,
                    "fx": fx_used,
                    "sources": [
                        source(
                            f"user_supplied:{SOURCE_ID}",
                            "user_supplied",
                            title=SOURCE_ID,
                            retrieved_at=RECEIVED,
                        )
                    ],
                    "confidence": "low",
                }
            )
    return out
