"""Target-customer ingest: bands, areas, sectors and links, on the real workbooks."""

import pytest

from atlas.config import CUSTOMER_REVENUE_BANDS, CUSTOMER_TEAM_BANDS
from atlas.ingest import customers
from atlas.model import Store


def _store(*named: tuple[str, list[str]]) -> Store:
    store = Store()
    for cid, names in named:
        store.competitors[cid] = {"id": cid, "name": cid, "named_customers": names}
    return store


@pytest.fixture(scope="module")
def records() -> list[dict]:
    return customers.build(
        _store(("co_a", ["Bosch", "Larsen and Toubro", "Whirlpool"]), ("co_b", ["Hyundai"]))
    )


def test_band_parsing():
    assert customers.band("<100", CUSTOMER_REVENUE_BANDS) == "lt_100"
    assert customers.band("500–2,000", CUSTOMER_REVENUE_BANDS) == "500_2000"
    assert customers.band(">50,000", CUSTOMER_TEAM_BANDS) == "gt_50000"
    assert customers.band("about 300", CUSTOMER_REVENUE_BANDS) is None
    # Hyderabad cells carry qualifiers; the band is what they start with.
    assert customers.band("500–2,000 (₹603 Cr FY26)", CUSTOMER_REVENUE_BANDS) == "500_2000"
    assert customers.band("<500 (51–200)", CUSTOMER_TEAM_BANDS) == "lt_500"
    assert customers.band("Not public (est. large)", CUSTOMER_REVENUE_BANDS) is None
    assert customers.band("Govt (DAE)", CUSTOMER_REVENUE_BANDS) is None
    assert customers.band(None, CUSTOMER_TEAM_BANDS) is None


def test_areas_prefer_longer_names_and_skip_unknown_places():
    assert customers.areas("Navi Mumbai (Mahape)") == ["navi_mumbai"]
    assert customers.areas("Mumbai; Airoli plant") == ["mumbai", "navi_mumbai"]
    assert customers.areas("Bengaluru (Tumakuru Road)") == ["bengaluru_metro"]
    assert customers.areas("Mumbai; Khandala plant") == ["mumbai"]
    assert customers.areas("Maharashtra plants") == []
    assert customers.areas("Pashamylaram; Yavapur (Sadasivpet); Chityal (Nalgonda)") == [
        "hyderabad_metro",
        "telangana_outer",
    ]
    assert customers.areas("Hyderabad HQ; plants at Tuni (AP), Ankleshwar, Goa") == [
        "hyderabad_metro",
        "andhra_pradesh",
        "gujarat",
    ]
    # District names that span the metro belt and beyond map to nothing on their own.
    assert customers.areas("Kongara Kalan, Ranga Reddy") == ["hyderabad_metro"]
    assert customers.areas("Telangana (verify plant location)") == []


def test_unknown_category_fails_loudly():
    with pytest.raises(customers.CustomerListError):
        customers.sectors("Shipbuilding")


def test_name_key_drops_legal_and_country_words():
    assert customers.name_key("Bosch Ltd") == customers.name_key("Bosch")
    assert customers.name_key("Whirlpool of India") == "whirlpool"
    assert customers.name_key("Larsen & Toubro") == customers.name_key("Larsen and Toubro")
    assert customers.name_key("Hindustan Aeronautics (HAL)") == "hindustan aeronautics"
    # The Hyderabad list names a site after a comma.
    assert customers.name_key("Mahindra & Mahindra, Zaheerabad") == customers.name_key(
        "Mahindra & Mahindra"
    )
    assert customers.name_key("Deepak Nitrite, Unit II (Hyderabad)") == "deepak nitrite"


def test_every_workbook_loads_whole(records):
    lists = ("mumbai_pune", "bengaluru", "hyderabad")
    by_list = {k: [r for r in records if r["list"] == k] for k in lists}
    assert len(by_list["mumbai_pune"]) == 142
    assert len(by_list["bengaluru"]) == 106
    assert len(by_list["hyderabad"]) == 249
    assert len({r["id"] for r in records}) == len(records)
    older = by_list["mumbai_pune"] + by_list["bengaluru"]
    assert all(r["revenue_band"] and r["team_band"] for r in older)
    assert all(r["archetype_fit"] is None and r["why_fit"] is None for r in older)
    assert all(r["sectors"] for r in records)
    # Only state-wide addresses name no mapped place.
    assert sorted(r["name"] for r in records if not r["areas"]) == [
        "Deccan Auto",
        "Hindustan Coca-Cola Beverages and franchise bottlers",
        "Resojet",
        "Shahi Exports",
    ]


def test_hyderabad_sheets_set_fit_and_archetype(records):
    hyd = [r for r in records if r["list"] == "hyderabad"]
    assert sum(r["archetype_fit"] == "high" for r in hyd) == 204
    assert sum(r["archetype_fit"] == "medium" for r in hyd) == 45
    assert all(r["archetype"] and r["why_fit"] for r in hyd)
    steel = next(r for r in hyd if r["name"] == "Nava Bharat Ventures")
    # The Adjacent sheet's "04 Steel and metals processing" splits into number and name.
    assert (steel["archetype"], steel["category"]) == ("04", "Steel and metals processing")
    assert steel["sectors"] == ["metals_machining"]
    not_public = [r for r in hyd if r["revenue_as_listed"] == "Not public"]
    assert not_public and all(r["revenue_band"] is None for r in not_public)


def test_same_company_on_both_lists_links_both_ways(records):
    by_id = {r["id"]: r for r in records}
    mp = by_id["cust_mp-bosch-ltd"]
    assert mp["also_listed_ids"] == ["cust_blr-bosch-ltd"]
    assert by_id["cust_blr-bosch-ltd"]["also_listed_ids"] == ["cust_mp-bosch-ltd"]
    mm = by_id["cust_hyd-mahindra-mahindra-zaheerabad"]
    assert mm["also_listed_ids"] == ["cust_mp-mahindra-mahindra"]


def test_competitor_links_are_exact_name_keys(records):
    linked = {r["name"] for r in records if r["competitor_ids"]}
    assert linked == {"Bosch Ltd", "Larsen & Toubro", "Whirlpool of India"}
    # "Hyundai" is not "Hyundai Motor India": no prefix or fuzzy matching.
    assert all("co_b" not in r["competitor_ids"] for r in records)
