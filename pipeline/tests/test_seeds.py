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


def test_physical_ai_list_names_and_tags():
    rows = seeds.read_physical_ai()
    by_listed = {r.name_as_listed: r for r in rows}
    assert len(rows) == 57
    assert by_listed["SOSV / SOSV HAX"].name == "SOSV"
    assert by_listed["M12 (Microsoft's venture fund)"].name == "M12"
    assert by_listed["MISUMI Americas (the new MISUMI Ventures fund)"].name == "MISUMI Ventures"
    assert {r.tag for r in rows} == set(seeds.PHYSICAL_AI_TAGS)


def test_vc_india_list_rows_and_hints():
    rows = seeds.read_vc_india()
    by = {r.name: r for r in rows}
    assert len(rows) == 145
    assert by["100X.VC"].link_field == "website"
    assert by["Exit Fund"].link_field == "linkedin"  # a LinkedIn page is not a website
    hint = by["Ankur Capital"].hint()
    assert hint["source_id"] == seeds.VC_INDIA_LIST
    assert hint["listed_check_or_fund"].startswith("$500,000 (the list does not say")
    assert (
        hint["notes"]
        == "Address as listed: India; Web address as listed: https://www.ankurcapital.com/"
    )
    # Focus first; the "about" text moves to the notes, or stands in when there is no focus.
    assert by["NGP Capital"].hint()["listed_focus"].startswith("NGP Capital is a growth-stage")


@pytest.mark.parametrize(
    ("address", "region"),
    [
        ("420 Lexington Avenue, Suite 1402, New York, NY 10170", "western"),  # NY is a state
        ("Boston, MA 02110, US", "western"),
        ("1 New Burlington Pl, Mayfair, London W1S 2HR, United Kingdom", "western"),
        ("UK", "western"),
        ("Mumbai, Maharashtra 100011, IN", "india"),
        ("Ebony 1203A, Godrej Woodsman Estate, Hebbal, Bangalore-560024, India", "india"),
        ("79 Anson Rd, #20-1, Central Business District, Singapore 07, SG", "other"),
        ("France,Germany,USA,India,Singapore", None),  # several regions
        (None, None),
    ],
)
def test_region_from_address(address, region):
    assert seeds.region_from_address(address) == region


def test_vc_india_names_stay_apart_from_similar_firms():
    from atlas.resolve import InvestorResolver

    for existing, listed in [
        ("Henkel", "Henkel Ventures"),
        ("Super Ventures", "Super Capital"),
        ("Founders Fund", "Founder Partners"),
        ("Founders Capital", "Founder Partners"),
        ("Vertex Ventures", "Vertex Ventures Southeast Asia & India"),
    ]:
        r = InvestorResolver()
        assert r.add(existing, "fund_list", "a") is not r.add(listed, "seed_list", "b")


def test_vc_india_list_through_the_pipeline(store):
    new = investor(store, "SecureOctane")
    assert new["user_tags"] == ["VC investing in India"]
    assert new["region"] == "western"
    assert new["website"] == "https://www.secureoctane.com/"
    cited = new["sources"][new["field_sources"]["website"][0]]
    assert cited["url"] == f"user_supplied:{seeds.VC_INDIA_LIST}"
    assert cited["retrieved_at"].startswith(seeds.VC_INDIA_RETRIEVED)
    assert new["seed_hints"][0]["listed_check_or_fund"] == "$250,000 to $500,000"
    assert new["check_min_usd"] is None  # list check sizes stay hints
    page = investor(store, "Exit Fund")
    assert page["website"] is None
    assert page["linkedin"] == "https://www.linkedin.com/company/exitfund"
    # A list address only fills a gap: the Bangalore address does not blank the fund-list region.
    assert investor(store, "Unitus Seed Fund")["region"] == "western"
