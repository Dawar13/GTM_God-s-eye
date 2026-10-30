"""Thesis vectors (atlas/analyze/thesis.py)."""

from atlas.analyze import thesis
from atlas.config import MIN_PORTFOLIO_ROUNDS
from atlas.model import Store, new_company, new_investor, new_round

SRC = [{"url": "https://example.com/a", "title": None, "publisher": None,
        "retrieved_at": "2026-10-30", "kind": "secondary"}]  # fmt: skip


def store_with_rounds(n: int, sector: str = "industrial_manufacturing") -> Store:
    store = Store()
    store.investors["inv_x"] = new_investor("inv_x", "X", sources=SRC, confidence="low")
    for i in range(n):
        co = new_company(f"co_{i}", f"Co {i}", sources=SRC, confidence="low")
        co["sector"] = sector
        store.companies[co["id"]] = co
        r = new_round(f"rnd_{i}", co["id"], stage="seed", sources=SRC, confidence="low")
        r["date"] = "2026-03-01"
        r["participant_investor_ids"] = ["inv_x"]
        store.rounds[r["id"]] = r
    return store


def test_a_portfolio_below_the_minimum_does_not_make_a_thesis():
    store = store_with_rounds(MIN_PORTFOLIO_ROUNDS - 1)
    thesis.compute(store)
    assert store.investors["inv_x"]["sector_weights"] is None


def test_a_portfolio_at_the_minimum_does():
    store = store_with_rounds(MIN_PORTFOLIO_ROUNDS)
    thesis.compute(store)
    sw = store.investors["inv_x"]["sector_weights"]
    assert sw["method"] == "portfolio_only"
    assert sw["value"] == {"industrial_manufacturing": 1.0}
