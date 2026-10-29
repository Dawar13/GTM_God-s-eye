"""Goldman sub-$200M fund list: extraction, parsing and anomaly flags (PHASE_0 §6.7)."""

import pytest

from atlas.ingest import goldman_pdf
from atlas.ingest.goldman_pdf import RawRow, parse_row

EXPECTED_ROWS = 971


@pytest.fixture(scope="module")
def funds():
    parsed, _ = goldman_pdf.parse_pdf()
    return parsed


def find(funds, name, year):
    matches = [f for f in funds if f.fund_name == name and f.year == year]
    assert len(matches) == 1, f"{name} {year}: {len(matches)} matches"
    return matches[0]


def reasons(fund):
    return {(a.field, a.reason) for a in fund.anomalies}


def test_row_count_within_two_percent(funds):
    assert abs(len(funds) - EXPECTED_ROWS) <= EXPECTED_ROWS * 0.02


def test_every_index_present_once(funds):
    indexes = sorted(f.row_index for f in funds if f.row_index is not None)
    assert indexes == list(range(1, EXPECTED_ROWS + 1))


@pytest.mark.parametrize(
    ("name", "size_musd", "year", "number", "location"),
    [
        ("Antler US Fund", 160, 2026, "II", "NYC"),
        ("Dorm Room Fund", 50, 2026, "II", "NYC"),
        ("Seven Stars", 40, 2025, "I", "Bay Area"),
        ("Root Ventures", 190, 2025, "IV", "Bay Area"),
    ],
)
def test_known_rows(funds, name, size_musd, year, number, location):
    fund = find(funds, name, year)
    assert fund.amount_musd == size_musd
    assert fund.size_usd == size_musd * 1_000_000
    assert fund.fund_number == number
    assert fund.location == location


def test_known_row_dates_and_links(funds):
    antler = find(funds, "Antler US Fund", 2026)
    assert (antler.date_iso, antler.date_precision) == ("2026-01-05", "day")
    assert antler.link.startswith("https://www.wsj.com/")


def test_impossible_dates_fall_back_to_year_column(funds):
    for name, year, raw in [
        ("Flybridge Ventures", 2025, "9/10/2925"),
        ("Verified", 2025, "715/2025"),
        ("Uncork", 2023, "6/27/0203"),
    ]:
        fund = find(funds, name, year)
        assert fund.date_raw == raw
        assert (fund.date_iso, fund.date_precision) == (str(year), "year")
        assert any(a.field == "date" for a in fund.anomalies)


def test_bad_amounts_are_flagged_and_left_null(funds):
    deciens = find(funds, "Deciens Capital", 2025)
    assert deciens.amount_musd is None
    assert ("amount", "amount is not a number") in reasons(deciens)

    anthology = find(funds, "Anthology Fund", 2024)
    assert anthology.amount_musd is None
    assert any("implausible" in r for _, r in reasons(anthology))


def test_rows_without_amounts_are_flagged(funds):
    missing = [f for f in funds if ("amount", "no amount listed") in reasons(f)]
    assert {f.fund_name for f in missing} >= {"PivotNorth", "Haywire", "BBG Ventures"}


def test_year_column_disagreeing_with_date_is_flagged(funds):
    prudence = find(funds, "Prudence", 2023)
    assert prudence.date_iso == "2024-03-07"
    assert any(field == "year" and "disagrees" in r for field, r in reasons(prudence))


def test_overflowing_links_are_rejoined(funds):
    forward = find(funds, "Forward Deployed", 2025)
    assert forward.link.endswith("SIsImlhdCI6MTc2NT")
    assert " " not in forward.link


def test_unindexed_rows_are_kept_and_flagged(funds):
    extra = [f for f in funds if f.row_index is None]
    assert {f.fund_name for f in extra} == {"Hyperstition", "BBG Ventures"}
    assert all(("row_index", "row has no index number") in reasons(f) for f in extra)


def test_notes_that_signal_a_target_lower_confidence(funds):
    point_judith = next(f for f in funds if f.fund_name == "Point Judith Capital")
    assert point_judith.confidence == "low"


def test_arabic_and_text_fund_numbers():
    row = RawRow("313", 313, ["Future Value Fund", "$10", "1/1/2019", "2019", "1", "Ohio", ""])
    assert parse_row(row).fund_number == "I"
    row = RawRow("772", 772, ["Homebrew Ventures", "$35", "1/1/2016", "2016", "Opp Fund", "SF", ""])
    fund = parse_row(row)
    assert fund.fund_number is None
    assert "Opp Fund" in fund.notes


def test_text_line_fallback_parses_an_indexed_line():
    line = "8Convective Capital $85 5/21/2026 2026 II Bay Area https://techcrunch.com/x"
    raw = goldman_pdf._from_text_line(line)
    assert raw is not None
    assert raw.row_index == 8
    assert raw.cells[:6] == ["Convective Capital", "$85", "5/21/2026", "2026", "II", "Bay Area"]
    assert raw.cells[6] == "https://techcrunch.com/x"
