import pytest

from atlas.geo import region_for_location
from atlas.names import (
    FirmName,
    firm_from_fund_name,
    has_vehicle_words,
    investing_name,
    match_key,
    parent_brand,
)
from atlas.resolve import InvestorResolver


@pytest.mark.parametrize(
    ("raw", "name", "aliases"),
    [
        ("Jeff Bezos (through Bezos Expeditions)", "Bezos Expeditions", ()),
        ("Jeff Bezos (via Bezos Expeditions Fund)", "Bezos Expeditions Fund", ()),
        ("In-Q-Tel (IQT)", "In-Q-Tel", ("IQT",)),
        ("GV (Google Ventures)", "GV", ("Google Ventures",)),
        ("SK Telecom Venture Capital (SKTVC)", "SK Telecom Venture Capital", ("SKTVC",)),
        ("NVentures (NVIDIA)", "NVentures", ()),  # parent, not another name
        ("Range Ventures (Chris Erickson)", "Range Ventures", ()),
        ("Accel (India)", "Accel (India)", ()),
        ("Seed Capital (Denmark)", "Seed Capital (Denmark)", ()),
        ("Lux Capital", "Lux Capital", ()),
        ("EQT VIII", "EQT", ()),
        ("Lux Capital Fund VII", "Lux Capital", ()),
        ("Accel X", "Accel X", ()),
    ],
)
def test_investing_name(raw, name, aliases):
    assert investing_name(raw) == FirmName(name, aliases)


@pytest.mark.parametrize(
    ("fund_name", "firm", "aliases"),
    [
        ("Union Square Ventures - climate fund", "Union Square Ventures", ()),
        ("Sino Global Capital, Liquid Value Fund", "Sino Global Capital", ()),
        ("Viola Ventures (fka Carmel Ventures)", "Viola Ventures", ("Carmel Ventures",)),
        ("Line (JV with Collaborative Fund)", "Line", ()),
        ("BoldStart Ventures Opportunity\nFund", "BoldStart Ventures Opportunity Fund", ()),
        ("Collaborative Fund", "Collaborative Fund", ()),
    ],
)
def test_firm_from_fund_name(fund_name, firm, aliases):
    result = firm_from_fund_name(fund_name)
    assert (result.name, result.aliases) == (firm, aliases)


@pytest.mark.parametrize(
    ("a", "b"),
    [
        ("Haystack", "Haystack Ventures"),
        ("Sequoia Seed Fund", "Sequoia Capital"),
        ("Sequoia Ventues", "Sequoia Capital"),
        ("Greycroft Growth", "Greycroft"),
        ("The House Fund", "House Fund"),
        ("Scribble Ventrues", "Scribble Ventures"),
    ],
)
def test_same_firm_same_key(a, b):
    assert match_key(a) == match_key(b)


def test_regional_arms_keep_their_own_key():
    assert match_key("Antler US Fund") != match_key("Antler")
    assert parent_brand("Antler US Fund") == "Antler"
    assert parent_brand("Accel India") == "Accel"
    assert parent_brand("Red Sea Ventures") is None
    assert parent_brand("Root Ventures") is None


def test_vehicle_words():
    assert has_vehicle_words("Sequoia Seed Fund")
    assert has_vehicle_words("Cendana Co-Investment Fund")
    assert not has_vehicle_words("Dorm Room Fund")
    assert not has_vehicle_words("Cendana Capital")


def test_do_not_merge_blocks_exact_and_fuzzy_matches():
    r = InvestorResolver()
    house_fund = r.add("The House Fund", "fund_list", "test")
    house_capital = r.add("House Capital", "fund_list", "test")
    assert house_fund is not house_capital
    assert r.add("House Fund", "fund_list", "test") is house_fund

    collide = r.add("Collide Capital", "fund_list", "test")
    assert r.add("Collider Ventures", "fund_list", "test") is not collide


def test_aliases_merge_both_ways():
    r = InvestorResolver()
    a16z = r.add("a16z", "round_list", "test")
    assert r.add("Andreessen Horowitz", "seed_list", "test") is a16z
    a16z.display_name = a16z.choose_display_name()
    assert a16z.display_name == "Andreessen Horowitz"


@pytest.mark.parametrize(
    ("location", "region"),
    [
        ("NYC", "western"),
        ("Bay Area, Israel", "western"),
        ("Toronto, Canada", "western"),
        ("Cincinnati, Oho", "western"),
        ("India", "india"),
        ("China", "other"),
        ("Bay Area, China", None),
        ("Seattle, USA / India", None),
        ("Global", None),
        ("", None),
        (None, None),
    ],
)
def test_region_for_location(location, region):
    assert region_for_location(location) == region
