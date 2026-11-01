"""Physical-AI landscape lists (atlas/ingest/landscape.py)."""

from atlas.ingest import landscape
from atlas.model import Store, new_company

SRC = [{"url": "user_supplied:x", "title": None, "publisher": None,
        "retrieved_at": "2026-11-01", "kind": "user_supplied"}]  # fmt: skip


def store_with(*companies: tuple[str, str]) -> Store:
    store = Store()
    for co_id, name in companies:
        store.companies[co_id] = new_company(co_id, name, sources=SRC, confidence="low")
    return store


def write(tmp_path, map_rows: str, yc_rows: str):
    m, y = tmp_path / "map.csv", tmp_path / "yc.csv"
    m.write_text("name,segment,region,note\n" + map_rows, encoding="utf-8")
    y.write_text("name,yc_batch,description_as_listed\n" + yc_rows, encoding="utf-8")
    return m, y


def test_ingest_merge_and_unique_match(tmp_path):
    m, y = write(
        tmp_path,
        'Ati Robotics,Factories,india,\nGeek,"Warehouses, logistics",global,"from logo"\n'
        "Acme Bots,Factories,global,\n",
        "Acme Bots,F26,Arms for everyone\nPreload,,Datasets\n",
    )
    store = store_with(
        ("co_ati-robotics", "Ati Robotics"),
        ("co_acme-a", "Acme Bots"),
        ("co_acme-b", "Acme Bots"),
        ("co_geek", "Geek"),  # a unique match, but the map's name came from a logo
    )
    recs = {r["name"]: r for r in landscape.build(store, m, y)}
    assert len(recs) == 4
    assert recs["Ati Robotics"]["id"] == "land_ati-robotics"
    assert recs["Ati Robotics"]["matched_id"] == "co_ati-robotics"
    assert recs["Geek"]["note"] == "from logo" and recs["Geek"]["matched_id"] is None
    # on both lists: one record, both lists, both sources; two exact matches -> no link
    both = recs["Acme Bots"]
    assert both["lists"] == ["market_map", "yc_physical_ai"]
    assert both["yc_batch"] == "F26" and both["segment"] == "Factories"
    assert len(both["sources"]) == 2 and both["matched_id"] is None
    # YC only: map fields and a blank batch stay null
    pre = recs["Preload"]
    assert pre["lists"] == ["yc_physical_ai"] and pre["yc_batch"] is None
    assert pre["segment"] is None and pre["region"] is None
    assert len(store.companies) == 4 and not store.competitors
