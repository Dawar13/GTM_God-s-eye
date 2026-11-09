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
    assert customers.band(None, CUSTOMER_TEAM_BANDS) is None


def test_areas_prefer_longer_names_and_skip_unknown_places():
    assert customers.areas("Navi Mumbai (Mahape)") == ["navi_mumbai"]
    assert customers.areas("Mumbai; Airoli plant") == ["mumbai", "navi_mumbai"]
    assert customers.areas("Bengaluru (Tumakuru Road)") == ["bengaluru_metro"]
    assert customers.areas("Mumbai; Khandala plant") == ["mumbai"]
    assert customers.areas("Maharashtra plants") == []


def test_unknown_category_fails_loudly():
    with pytest.raises(customers.CustomerListError):
        customers.sectors("Shipbuilding")


def test_name_key_drops_legal_and_country_words():
    assert customers.name_key("Bosch Ltd") == customers.name_key("Bosch")
    assert customers.name_key("Whirlpool of India") == "whirlpool"
    assert customers.name_key("Larsen & Toubro") == customers.name_key("Larsen and Toubro")
    assert customers.name_key("Hindustan Aeronautics (HAL)") == "hindustan aeronautics"


def test_both_workbooks_load_whole(records):
    by_list = {k: [r for r in records if r["list"] == k] for k in ("mumbai_pune", "bengaluru")}
    assert len(by_list["mumbai_pune"]) == 142
    assert len(by_list["bengaluru"]) == 106
    assert len({r["id"] for r in records}) == len(records)
    assert all(r["revenue_band"] and r["team_band"] for r in records)
    assert all(r["sectors"] for r in records)
    # Only the two state-wide addresses name no mapped place.
    assert sorted(r["name"] for r in records if not r["areas"]) == [
        "Hindustan Coca-Cola Beverages and franchise bottlers",
        "Shahi Exports",
    ]


def test_same_company_on_both_lists_links_both_ways(records):
    by_id = {r["id"]: r for r in records}
    mp = by_id["cust_mp-bosch-ltd"]
    assert mp["also_listed_ids"] == ["cust_blr-bosch-ltd"]
    assert by_id["cust_blr-bosch-ltd"]["also_listed_ids"] == ["cust_mp-bosch-ltd"]


def test_competitor_links_are_exact_name_keys(records):
    linked = {r["name"] for r in records if r["competitor_ids"]}
    assert linked == {"Bosch Ltd", "Larsen & Toubro", "Whirlpool of India"}
    # "Hyundai" is not "Hyundai Motor India": no prefix or fuzzy matching.
    assert all("co_b" not in r["competitor_ids"] for r in records)
