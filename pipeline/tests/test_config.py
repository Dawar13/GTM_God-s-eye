"""The pipeline's enums must match the TypeScript ones (via generated JSON Schema)."""

import json

import pytest

from atlas import config

ENUMS = json.loads((config.SCHEMAS / "enums.schema.json").read_text(encoding="utf-8"))["$defs"]


@pytest.mark.parametrize(
    ("ts_name", "py_values"),
    [
        ("Sector", config.SECTORS),
        ("Region", config.REGIONS),
        ("InvestorType", config.INVESTOR_TYPES),
        ("RoundStage", config.ROUND_STAGES),
        ("SourceKind", config.SOURCE_KINDS),
        ("CustomerList", config.CUSTOMER_LISTS),
        ("CustomerRevenueBand", config.CUSTOMER_REVENUE_BANDS),
        ("CustomerTeamBand", config.CUSTOMER_TEAM_BANDS),
        ("CustomerSector", config.CUSTOMER_SECTORS),
        ("CustomerArea", config.CUSTOMER_AREAS),
        ("CustomerFit", config.CUSTOMER_FITS),
    ],
)
def test_enum_matches_typescript(ts_name, py_values):
    assert list(py_values) == ENUMS[ts_name]["enum"]


def test_freshness_cutoff_is_24_months_before_reference_date():
    assert config.FRESHNESS_CUTOFF == "2024-10-29"


def test_name_match_threshold():
    assert config.NAME_MATCH_THRESHOLD == 92
