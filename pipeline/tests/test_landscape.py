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


def write(tmp_path, map_rows: str, yc_rows: str, sf_rows: str = "", robo_rows: str = ""):
    m, y = tmp_path / "map.csv", tmp_path / "yc.csv"
    sf, r = tmp_path / "sf.csv", tmp_path / "robo.csv"
    m.write_text("name,segment,region,note\n" + map_rows, encoding="utf-8")
    y.write_text("name,yc_batch,description_as_listed\n" + yc_rows, encoding="utf-8")
    sf.write_text("name,stage_as_listed,note\n" + sf_rows, encoding="utf-8")
    head = "name,segment,founded_as_listed,description_as_listed,founders_as_listed,note\n"
    r.write_text(head + robo_rows, encoding="utf-8")
    return m, y, sf, r


def test_ingest_merge_and_unique_match(tmp_path):
    paths = write(
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
    recs = {r["name"]: r for r in landscape.build(store, *paths)}
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


def test_stage_list_and_robotics_map(tmp_path):
    paths = write(
        tmp_path,
        'Origin,Construction,india,"name taken from the logo"\n',
        "",
        "Tacta Systems,Series A,\n"
        'Config,Seed,"Not linked: same name, not confirmed"\n'
        "Origin,Seed,\n"
        "Sight Machine,Series C,\n",
        'Tacta Systems,Hands & Touch,2023+,"a robotic hand, a tactile sensor",'
        'Vikram Pavate + Andreas Bibl,"shown on the map as Tacta; full name from the post"\n'
        'Innate,"Delivery, Food & Home",2023+,general purpose robots,Axel Peytavin,\n'
        "Built,Construction & Energy,2015 to 2019,,,\n",
    )
    store = store_with(
        ("co_config", "Config"),
        ("co_origin", "Origin"),
        ("co_sight-machine", "Sight Machine"),
    )
    recs = {r["name"]: r for r in landscape.build(store, *paths)}
    assert len(recs) == 6
    # on the stage post and the robotics map: one record with both lists and both sources
    tacta = recs["Tacta Systems"]
    assert tacta["lists"] == ["sf_robotics_industrial_ai", "robotics_market_map"]
    assert tacta["stage_as_listed"] == "Series A"
    assert tacta["robotics_map_segment"] == "Hands & Touch"
    assert tacta["founded_as_listed"] == "2023+"
    assert tacta["description_as_listed"] == "a robotic hand, a tactile sensor"
    assert tacta["founders_as_listed"] == ["Vikram Pavate", "Andreas Bibl"]
    assert tacta["note"] == "shown on the map as Tacta; full name from the post"
    assert [s["retrieved_at"] for s in tacta["sources"]] == ["2026-11-11", "2026-11-12"]
    # a unique exact match links unless the row says it is not confirmed
    assert recs["Sight Machine"]["matched_id"] == "co_sight-machine"
    assert recs["Config"]["matched_id"] is None
    # the map's logo note stays with the merged record and keeps it unlinked
    origin = recs["Origin"]
    assert origin["lists"] == ["market_map", "sf_robotics_industrial_ai"]
    assert origin["note"] == "name taken from the logo" and origin["matched_id"] is None
    innate = recs["Innate"]
    assert innate["founders_as_listed"] == ["Axel Peytavin"]
    assert innate["stage_as_listed"] is None and innate["segment"] is None
    assert innate["robotics_map_segment"] == "Delivery, Food & Home"
    # a map entry outside the ten teams has no one-liner or founders
    built = recs["Built"]
    assert built["description_as_listed"] is None and built["founders_as_listed"] == []
