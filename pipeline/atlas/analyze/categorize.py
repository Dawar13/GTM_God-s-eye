"""Deterministic categories (PROJECT_CONTEXT §3): freshness, maturity, early stage."""

from atlas.config import FRESHNESS_CUTOFF
from atlas.model import Store

ROMAN = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}
EARLY = {"pre_seed", "seed", "series_a"}


def roman_to_int(numeral: str) -> int:
    total, prev = 0, 0
    for ch in reversed(numeral):
        v = ROMAN[ch]
        total = total - v if v < prev else total + v
        prev = max(prev, v)
    return total


def latest_fund(funds: list[dict]) -> dict | None:
    dated = [f for f in funds if f["close_date"] or f["vintage_year"]]
    if not dated:
        return None
    return max(dated, key=lambda f: (f["close_date"] or str(f["vintage_year"]), f["size_usd"] or 0))


def categorize(store: Store) -> None:
    by_investor: dict[str, list[dict]] = {}
    for f in store.funds.values():
        by_investor.setdefault(f["investor_id"], []).append(f)
    for inv in store.investors.values():
        cat = inv["category"]
        funds = by_investor.get(inv["id"], [])
        latest = latest_fund(funds)
        if latest is None:
            cat["freshness"] = "unknown"
        else:
            closed = latest["close_date"] or str(latest["vintage_year"])
            # A year-only close counts as fresh only if the whole year is after the cutoff.
            cat["freshness"] = "fresh" if closed >= FRESHNESS_CUTOFF else "older"
        numbers = [roman_to_int(f["number"]) for f in funds if f["number"]]
        latest_number = (
            roman_to_int(latest["number"])
            if latest and latest["number"]
            else max(numbers, default=0)
        )
        if latest_number:
            cat["maturity"] = (
                "debut"
                if latest_number == 1
                else "emerging"
                if latest_number <= 3
                else "established"
            )
        if inv["stages"]:
            cat["is_early_stage"] = bool(EARLY & set(inv["stages"]))
