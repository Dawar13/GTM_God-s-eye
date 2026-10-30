"""Accelerator programmes from the user's list (atlas/ingest/accelerators.py)."""

import pytest

from atlas.ingest import accelerators
from atlas.model import Store, new_investor

SRC = [{"url": "user_supplied:x", "title": None, "publisher": None,
        "retrieved_at": "2026-10-30", "kind": "user_supplied"}]  # fmt: skip

HEADER = "rank,program,firm_as_named,terms_as_listed,headline_amount,currency,upfront_amount,upfront_equity_pct,equity_free\n"  # noqa: E501


def store_with(*investors: tuple[str, str, list[str]]) -> Store:
    store = Store()
    for inv_id, name, aliases in investors:
        inv = new_investor(inv_id, name, sources=SRC, confidence="low")
        inv["aliases"] = aliases
        store.investors[inv_id] = inv
    return store


def test_links_unique_names_and_leaves_ambiguous_ones(tmp_path):
    csv = tmp_path / "list.csv"
    csv.write_text(
        HEADER
        + "1,Y Combinator,Y Combinator,$500k: $125k for 7% + $375k MFN SAFE,500000,USD,125000,7,\n"
        + "2,NEO Residency,Neo,$750k uncapped SAFE,750000,USD,750000,,\n"
        + "3,Antler Europe,Antler,€500k: €200k upfront + €300k follow-on,500000,EUR,200000,,\n"
        + "4,Google for Startups Accelerator,Google,equity-free,,,,,true\n",
        encoding="utf-8",
    )
    store = store_with(
        ("inv_y-combinator", "Y Combinator", ["YC"]),
        ("inv_neo", "Neo", []),
        ("inv_neo-capital", "Neo Capital", ["Neo"]),  # "Neo" now fits two records
        ("inv_antler", "Antler", []),
    )
    progs = {p["name"]: p for p in accelerators.build(store, csv)}

    assert progs["Y Combinator"]["investor_id"] == "inv_y-combinator"
    assert progs["Y Combinator"]["upfront_equity_pct"] == 7
    assert progs["NEO Residency"]["investor_id"] is None
    assert progs["Google for Startups Accelerator"]["investor_id"] is None
    assert progs["Google for Startups Accelerator"]["equity_free"] is True
    assert progs["Google for Startups Accelerator"]["headline_usd"] is None
    antler = progs["Antler Europe"]
    assert antler["investor_id"] == "inv_antler"
    assert antler["currency"] == "EUR"
    assert antler["headline_usd"] == pytest.approx(500_000 * 1.1199, rel=1e-3)
