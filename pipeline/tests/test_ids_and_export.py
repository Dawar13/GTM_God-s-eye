import json

import pytest

from atlas import ids
from atlas.export.write_json import SchemaValidationError, write_dataset
from atlas.model import new_investor, user_source


def test_ids_follow_the_scheme():
    assert ids.investor_id("Root Ventures") == "inv_root-ventures"
    assert ids.fund_id("root-ventures", "IV", 2025) == "fund_root-ventures_iv"
    assert ids.fund_id("seedil", None, 2024) == "fund_seedil_2024"
    assert ids.company_id("NEURA Robotics") == "co_neura-robotics"
    assert ids.round_id("atoms", "2026", "undisclosed") == "rnd_atoms_2026_undisclosed"
    assert ids.round_id("atoms", "2026-05-21", "seed") == "rnd_atoms_2026-05_seed"


def test_registry_suffixes_collisions():
    reg = ids.IdRegistry()
    assert reg.claim("inv_a") == "inv_a"
    assert reg.claim("inv_a") == "inv_a-2"
    assert reg.claim("inv_a") == "inv_a-3"


def test_slug_rejects_empty():
    with pytest.raises(ValueError):
        ids.slug("&&")


def test_write_dataset_validates_against_json_schema(tmp_path):
    good = new_investor(
        "inv_root-ventures",
        "Root Ventures",
        sources=[user_source("goldman_sub200m_funds")],
        confidence="medium",
    )
    path = write_dataset("investors", [good], "2026-10-29T00:00:00+00:00", out_dir=tmp_path)
    assert json.loads(path.read_text(encoding="utf-8"))["records"][0]["id"] == "inv_root-ventures"

    bad = dict(good, sources=[])
    with pytest.raises(SchemaValidationError, match="inv_root-ventures"):
        write_dataset("investors", [bad], "2026-10-29T00:00:00+00:00", out_dir=tmp_path)
