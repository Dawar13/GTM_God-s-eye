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


# --- Investor lists of 2026-11-12 in the shared layout -------------------------------------


def listed_rows() -> dict[str, list[seeds.ListedInvestor]]:
    return {spec.tag: seeds.read_listed(spec) for spec in seeds.LISTED}


def test_listed_lists_rows_types_and_hints():
    rows = listed_rows()
    assert {tag: len(r) for tag, r in rows.items()} == {
        "New York seed funds": 84,
        "750+ seed funds list": 786,
        "DocSend early-stage list": 361,
        "Australia and New Zealand": 146,
        "US angels": 382,
        "Singapore (Map of the Money)": 111,
    }
    assert {r.type for r in rows["US angels"]} == {"angel"}  # the list's kind
    assert {r.type for r in rows["Australia and New Zealand"]} == {"vc"}  # its Type column
    assert {r.type for r in rows["DocSend early-stage list"]} == {None}

    angel = next(r for r in rows["US angels"] if r.name == "Jared Hecht")
    hint = angel.hint()
    assert hint["listed_focus"] is None  # a day job is not an investment focus
    assert hint["notes"].startswith("Co-Founder & Chief Executive Officer at Fundera")
    assert "Location as listed: New York, New York" in hint["notes"]

    au = next(r for r in rows["Australia and New Zealand"] if r.name == "Blackbird Ventures")
    assert "Type as listed" not in (au.hint()["notes"] or "")  # it became the type field

    docsend = {r.name: r for r in rows["DocSend early-stage list"]}
    assert "Female founders focus" in docsend["406 Ventures"].tags
    assert docsend["Equation Angels"].name_as_listed == "Equation Angels | Southwestern …"


@pytest.mark.parametrize(
    "location, region",
    [
        ("Sydney", "western"),
        ("Auckland", "western"),
        ("Boston, Massachusetts", "western"),
        ("Washington, District of Columbia", "western"),
        ("Georgia", None),  # a state and a country
    ],
)
def test_places_named_by_the_new_lists(location, region):
    assert seeds.region_from_address(location) == region


def test_listed_names_stay_apart_from_similar_firms():
    from atlas.resolve import InvestorResolver

    for existing, listed in [
        ("Revolution Ventures", "Evolution VC Partners"),
        ("NVentures", "Inventures"),
        ("Tomorrow Capital", "Tomorrow Ventures"),
        ("iSeed", "iSeed Ventures"),
        ("Next Wave Ventures", "NextWave Ventures"),
        ("NextGen Venture Partners", "NextGen Ventures"),
        ("Atlas Venture", "Atlas Ventures"),
        ("Quest Venture Partners", "Quest Ventures"),
        ("Vertex Ventures", "Vertex"),
    ]:
        r = InvestorResolver()
        assert r.add(existing, "fund_list", "a") is not r.add(listed, "seed_list", "b")
    # Canberra's ACTivate Capital carries its city, so a round naming the US firm
    # "Activate Capital" still finds it.
    r = InvestorResolver()
    us = r.add("Activate", "seed_list", "a")
    assert r.add("ACTivate Capital (Canberra)", "seed_list", "b") is not us
    assert r.add("Activate Capital", "round_list", "c") is us


def test_a_large_list_never_renames_a_known_firm():
    from atlas.resolve import InvestorResolver

    r = InvestorResolver()
    group = r.add("Alpine Meridian Ventures", "round_list", "rounds")
    assert r.add("Alpine Meridien", "seed_list", "big_list") is group
    assert group.choose_display_name() == "Alpine Meridien"  # a seed list names firms...
    assert group.choose_display_name(frozenset({"big_list"})) == "Alpine Meridian Ventures"


def test_listed_lists_through_the_pipeline(store):
    angel = investor(store, "Jared Hecht")
    assert angel["type"] == "angel"
    assert angel["user_tags"] == ["US angels"]
    assert angel["linkedin"] == "http://www.linkedin.com/in/jaredhecht"
    assert angel["region"] == "western"
    cited = angel["sources"][angel["field_sources"]["type"][0]]
    assert cited["url"] == "user_supplied:us_angel_investors_list_2026_11_12"
    assert cited["retrieved_at"].startswith("2026-11-12")
    assert angel["check_min_usd"] is None and angel["stages"] == []  # hints only

    tagged = investor(store, ".406 Ventures")  # the Goldman name stays
    assert {"DocSend early-stage list", "Female founders focus"} <= set(tagged["user_tags"])
    assert investor(store, "ACTivate Capital (Canberra)")["region"] == "western"
    # A city on a large list never blanks a region a street address gave (Boston vs
    # the Australia list's "Singapore").
    assert investor(store, "MassMutual Ventures")["region"] == "western"
    # Both lists' hints are kept on one record.
    melt = investor(store, "Melt Ventures")
    assert (
        sum(h["source_id"] == "australia_nz_investors_list_2026_11_12" for h in melt["seed_hints"])
        == 2
    )


def test_listed_tags_and_list_ids_are_known_to_the_app():
    """Every tag is a Tag filter option (USER_TAGS) and every list has a label."""
    from atlas.config import REPO_ROOT

    filters = (REPO_ROOT / "src/lib/filters/index.ts").read_text(encoding="utf-8")
    labels = (REPO_ROOT / "src/lib/format/labels.ts").read_text(encoding="utf-8")
    for spec in seeds.LISTED:
        assert f'"{spec.tag}"' in filters, spec.tag
        assert f"{spec.source_id}:" in labels, spec.source_id
    for tag in seeds.FOUNDER_FOCUS_TAGS:
        assert f'"{tag}"' in filters, tag


@pytest.mark.parametrize(
    "text, parsed",
    [
        ("$100K-$10M+", (100_000, 10_000_000)),
        ("$1M-2.5M", (1_000_000, 2_500_000)),
        ("$50-500K", (50_000, 500_000)),
        ("$50-$5M", None),  # $50K or $50M: not clear
        ("$100,000 to $1,500,000", (100_000, 1_500_000)),
        ("from $5,000,000 (no largest check listed)", (5_000_000, None)),
        ("$10M+", (10_000_000, None)),
        ("up to $1M", (None, 1_000_000)),
        ("$500K-1M, $1M-5M", None),
        ("$100k", None),
        ("€1-3M", None),
        ("$2,000,000 (the list does not say whether this is the smallest or largest check)", None),
        ("$150,000 then $50,000 (the smallest-check figure is the larger one as listed)", None),
        (None, None),
    ],
)
def test_parse_check_range(text, parsed):
    assert seeds.parse_check_range(text) == parsed


def test_map_of_the_money_rows_and_figures():
    rows = {r.name: r for r in listed_rows()["Singapore (Map of the Money)"]}
    durians = rows["500 Startups (Durians)"]
    assert durians.type == "vc"
    assert durians.check_usd == {"min": 25_000, "p25": 100_000, "p75": 160_000, "max": 290_000}
    assert durians.fund_size_usd == 25_000_000
    hint = durians.hint()
    assert hint["listed_check_usd"]["p25"] == 100_000
    assert hint["listed_fund_size_usd"] == 25_000_000
    assert "verified (the investor shared recent cheque sizes)" in hint["notes"]
    assert rows["Monk's Hill"].check_usd["max"] == 5_000_000  # escaped quote in the source
    # Size 0 on the map means not given.
    assert (
        rows["Burda"].fund_size_usd is None and "listed_fund_size_usd" not in rows["Burda"].hint()
    )
    assert rows["Cap Vista"].type is None  # "Government VC" is not an investor type
    assert "Type as listed: Government VC" in rows["Cap Vista"].hint()["notes"]


def test_vc_india_hints_carry_figures():
    hints = {r.name: r.hint() for r in seeds.read_vc_india()}
    assert hints["SecureOctane"]["listed_check_usd"] == {
        "min": 250_000,
        "p25": None,
        "p75": None,
        "max": 500_000,
    }
    lone = [
        h for h in hints.values() if "does not say whether" in (h["listed_check_or_fund"] or "")
    ]
    assert lone and all("listed_check_usd" not in h for h in lone)


def test_map_of_the_money_through_the_pipeline(store):
    durians = investor(store, "500 Startups (Durians)")
    assert durians["user_tags"] == ["Singapore (Map of the Money)"]
    assert durians["seed_hints"][0]["listed_check_usd"]["max"] == 290_000
    assert durians["check_min_usd"] is None  # list figures stay hints
    assert durians["region"] is None  # "active in Singapore" is not an HQ
    assert investor(store, "Atlas Ventures")["website"] == "http://atlasam.com.sg"
