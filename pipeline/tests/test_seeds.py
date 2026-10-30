"""Seed lists (PHASE_0 §7), parsed alone and through the whole pipeline."""

import pytest

from atlas import run
from atlas.ingest import seeds
from atlas.model import Store


@pytest.mark.parametrize(
    ("raw", "usd"),
    [("1.7B", 1_700_000_000), ("1.03B", 1_030_000_000), ("900M", 900_000_000), ("52M", 52_000_000)],
)
def test_parse_amount(raw, usd):
    assert seeds.parse_amount(raw) == usd


def test_parse_names():
    assert seeds.parse_names("Tether; Amazon; Nvidia") == (["Tether", "Amazon", "Nvidia"], [])
    assert seeds.parse_names("Cathay Innovation (+4 co-leads)") == (
        ["Cathay Innovation"],
        ["+4 co-leads not named in the list"],
    )
    assert seeds.parse_names("undisclosed") == ([], ["lead not disclosed in the list"])


def test_seed_files_row_counts():
    assert len(seeds.read_seed_investors()) == 196
    rounds = seeds.read_seed_rounds()
    assert len(rounds) == 50
    atoms = next(r for r in rounds if r.company == "Atoms")
    assert (atoms.leads, atoms.unspecified, atoms.stage) == ([], ["a16z"], "undisclosed")
    river = next(r for r in rounds if r.company == "River AI")
    assert river.leads == ["General Catalyst", "AMP"]
    assert river.participants == ["AMD", "Temasek"]
    assert river.stage == "seed"


@pytest.fixture(scope="module")
def store():
    s = Store()
    run.run(s, research=False)  # seed handling alone, before research overrides it
    return s


def investor(store, name):
    matches = [i for i in store.investors.values() if i["name"] == name]
    assert len(matches) == 1, f"{name}: {len(matches)}"
    return matches[0]


def test_hints_are_kept_not_trusted(store):
    crane = investor(store, "Crane Venture Partners")
    assert crane["seed_list_count"] == 2
    assert {h["listed_check_or_fund"] for h in crane["seed_hints"]} == {
        "Q3 2026 fund close $150M",
        "2026 fund $484M",
    }
    assert crane["check_min_usd"] is None and crane["check_max_usd"] is None


def test_frontier_list_types_and_flags(store):
    nvidia = investor(store, "NVIDIA")
    assert nvidia["type"] == "strategic"
    assert nvidia["flags"] == ["not_early_stage_target_by_default"]
    assert "Nvidia" in nvidia["aliases"]
    # Sequoia runs seed funds on the Goldman list, so it is not flagged.
    sequoia = investor(store, "Sequoia Capital")
    assert sequoia["flags"] == []
    assert len(sequoia["funds"]) == 4


def test_accel_regional_arms(store):
    for name, region in [
        ("Accel (US)", "western"),
        ("Accel (Europe & Israel)", "western"),
        ("Accel (India)", "india"),
    ]:
        arm = investor(store, name)
        assert (arm["parent_brand"], arm["region"]) == ("Accel", region)
    assert investor(store, "Accel")["parent_brand"] is None


def test_different_firms_stay_apart(store):
    for a, b in [
        ("IDG Capital", "IDG Ventures"),
        ("Spark Capital", "Spark Growth Ventures"),
        ("Cleo Capital", "Cleo Ventures"),
        ("Atomic", "Atomico"),
    ]:
        assert investor(store, a)["id"] != investor(store, b)["id"]


def test_rounds_merge_across_lists_and_keep_roles(store):
    walden = [r for r in store.rounds.values() if r["company_id"] == "co_walden-robotics"]
    assert len(walden) == 1
    r = walden[0]
    assert r["stage"] == "seed"
    assert len(r["sources"]) == 2
    assert r["lead_investor_ids"] == ["inv_deviation-capital", "inv_toyota"]
    assert r["participant_investor_ids"] == ["inv_boeing", "inv_samsung"]
    assert r["unspecified_investor_ids"] == []
    assert (r["date"], r["date_precision"], r["confidence"]) == ("2026", "year", "low")


def test_round_investors_resolve_to_existing_investors(store):
    atoms = store.rounds["rnd_atoms_2026_undisclosed"]
    assert atoms["unspecified_investor_ids"] == ["inv_andreessen-horowitz"]


def test_india_seed(store):
    assert investor(store, "ajvc")["region"] == "india"
