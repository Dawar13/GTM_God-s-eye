"""Merging research files into the store (atlas/enrich/research.py)."""

import pytest

from atlas import build
from atlas.enrich import research
from atlas.model import Store
from atlas.resolve import InvestorResolver

TODAY = "2026-10-30"


def page(url: str, kind: str) -> dict:
    return {"url": url, "title": None, "publisher": None, "retrieved_at": TODAY, "kind": kind}


def fact(value, pages=(0,)):
    return {"value": value, "pages": list(pages), "snippet": "supporting words"}


def company(name: str, website: str | None) -> dict:
    return {
        "name": name,
        "website": website,
        "description": "Robots for factories",
        "hq_country": "US",
        "founded_year": 2022,
        "sector": "robotics_physical_ai",
        "sector_classified_by": "source",
        "layer": "robotics",
    }


def rnd(name, website, *, leads=(), participants=(), amount=5_000_000, pages=(1,)):
    return {
        "company": company(name, website),
        "stage": "seed",
        "stage_raw": "Seed",
        "date": "2026-03-10",
        "date_precision": "day",
        "amount_original": amount,
        "currency_original": "USD",
        "valuation_post_original": None,
        "leads": list(leads),
        "participants": list(participants),
        "unspecified": [],
        "pages": list(pages),
        "snippet": "raised a seed round",
    }


def investor_file(key, name, *, rounds=(), funds=(), facts=None, pages=None) -> dict:
    return {
        "key": key,
        "entity_type": "investor",
        "tier": "A",
        "name": name,
        "status": "active",
        "researched_at": TODAY,
        "identity_check": "own domain",
        "pages": pages
        or [page(f"https://{key}.vc/", "primary"), page("https://techcrunch.com/a", "press")],
        "facts": facts or {},
        "funds": list(funds),
        "partners": [],
        "rounds": list(rounds),
        "conflicts": [],
        "open_items": [],
    }


def merge(files: list[dict], phase0_names=("Root Ventures",)) -> Store:
    resolver = InvestorResolver()
    for n in phase0_names:
        resolver.add(n, "fund_list", "goldman_sub200m_funds")
    loaded = research.Loaded(investors=files)
    research.register(resolver, loaded)
    store = Store()
    build.assign_investor_ids(resolver)
    build.build_investors_and_funds(store, resolver, [])
    research.apply(store, loaded, {})
    return store


def test_confidence_from_pages():
    assert research.confidence_for([page("https://a.vc", "primary")]) == "high"
    two_press = [page("https://techcrunch.com/x", "press"), page("https://axios.com/y", "press")]
    assert research.confidence_for(two_press) == "high"
    assert research.confidence_for(two_press[:1]) == "medium"
    same_domain = [
        page("https://techcrunch.com/x", "press"),
        page("https://techcrunch.com/z", "press"),
    ]
    assert research.confidence_for(same_domain) == "medium"
    assert research.confidence_for([page("https://crunchbase.com/x", "database")]) == "low"


def test_investor_facts_cited_and_region_from_country():
    f = investor_file(
        "root-ventures",
        "Root Ventures",
        facts={
            "website": fact("https://root.vc"),
            "hq_country": fact("US"),
            "stages": fact(["pre_seed", "seed"]),
        },
    )
    store = merge([f])
    inv = store.investors["inv_root-ventures"]
    assert inv["website"] == "https://root.vc"
    assert inv["region"] == "western"
    assert inv["confidence"] == "high"
    assert set(inv["field_sources"]) >= {"website", "hq_country", "stages", "region"}
    assert inv["tier"] == "A"


def test_check_range_in_inr_is_converted():
    f = investor_file(
        "ajvc",
        "ajvc",
        facts={"check_range": fact({"min": 15_000_000, "max": 15_000_000, "currency": "INR"})},
    )
    inv = next(iter(merge([f], phase0_names=()).investors.values()))
    assert inv["check_min_usd"] == pytest.approx(15_000_000 / 94.94, rel=1e-3)


def test_same_round_from_two_investors_is_one_round_and_lead_wins():
    a = investor_file(
        "root-ventures",
        "Root Ventures",
        rounds=[
            rnd("Acme Robotics", "https://acme.ai", leads=["Root Ventures"], participants=["Lux"])
        ],
    )
    b = investor_file(
        "lux",
        "Lux",
        rounds=[
            rnd("Acme Robotics Inc", "https://www.acme.ai/", participants=["Root Ventures", "Lux"])
        ],
    )
    store = merge([a, b], phase0_names=("Root Ventures", "Lux"))
    assert len(store.companies) == 1  # same domain
    assert len(store.rounds) == 1
    r = next(iter(store.rounds.values()))
    assert r["lead_investor_ids"] == ["inv_root-ventures"]
    assert r["participant_investor_ids"] == ["inv_lux"]
    assert r["amount_usd"] == 5_000_000
    assert r["confidence"] == "medium"


def test_co_investor_named_only_in_research_cites_the_round_page():
    f = investor_file(
        "root-ventures",
        "Root Ventures",
        rounds=[rnd("Acme", "https://acme.ai", leads=["Root Ventures"], participants=["Lux"])],
    )
    store = merge([f])
    lux = store.investors["inv_lux"]
    assert [s["url"] for s in lux["sources"]] == ["https://techcrunch.com/a"]
    assert lux["field_sources"] == {"name": [0]}
    every = [s["url"] for inv in store.investors.values() for s in inv["sources"]]
    assert not any(u.startswith("user_supplied:research") for u in every)


def test_a_sourced_alias_in_a_round_is_the_firm_itself():
    f = investor_file(
        "onesixone-ventures",
        "OneSixOne Ventures",
        facts={"aliases": fact(["1.61 Ventures"])},
        rounds=[rnd("Acme", "https://acme.ai", participants=["1.61 Ventures"])],
    )
    store = merge([f], phase0_names=())
    assert list(store.investors) == ["inv_onesixone-ventures"]
    r = next(iter(store.rounds.values()))
    assert r["participant_investor_ids"] == ["inv_onesixone-ventures"]


def test_disagreeing_amounts_mark_the_round_contested():
    a = investor_file(
        "root-ventures",
        "Root Ventures",
        rounds=[rnd("Acme", "https://acme.ai", leads=["Root Ventures"])],
    )
    b = investor_file(
        "lux",
        "Lux",
        rounds=[rnd("Acme", "https://acme.ai", participants=["Lux"], amount=9_000_000)],
    )
    store = merge([a, b], phase0_names=("Root Ventures", "Lux"))
    r = next(iter(store.rounds.values()))
    assert r["contested"] is True
    assert any(x["field"] == "round.amount" for x in store.anomalies)


def test_funds_match_by_number_and_convert_currency():
    fund = {
        "name": "Fund II",
        "number": "II",
        "size_original": 100_000_000,
        "currency_original": "EUR",
        "close_date": "2024-05",
        "date_precision": "month",
        "pages": [0],
        "snippet": "closed fund II",
    }
    store = merge([investor_file("root-ventures", "Root Ventures", funds=[fund])])
    (f,) = store.funds.values()
    assert f["number"] == "II"
    assert f["size_usd"] == pytest.approx(100_000_000 / 0.924, rel=1e-6)
    assert f["fx"]["rate_period"] == "2024"
    assert f["vintage_year"] == 2024
