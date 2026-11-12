"""User seed lists (PHASE_0 §7).

seed_investors.csv: names from nine user-supplied lists. Listed focus and
check sizes are hints for Phase 1 to verify, never facts.
seed_rounds.csv: rounds from the robotics (>= $20M) and AI mega-seed lists.
Amounts and dates are low confidence until verified.
"""

import csv
import re
from dataclasses import dataclass, field
from pathlib import Path

from atlas.config import PHYSICAL_AI_CSV, SEED_INVESTORS_CSV, SEED_ROUNDS_CSV, VC_INDIA_CSV
from atlas.geo import region_for_country, region_for_location
from atlas.names import clean, investing_name

FRONTIER_LIST = "multiples_frontier_lab_investors_2026-10-28"

# Lists whose own scope fixes the region of every name on them.
REGION_SCOPED_LISTS = {"li_20_b2b_ai_funds_2026": "western"}  # "US/UK/EU funds"

# Type guesses for the frontier-labs list (PHASE_0 §7.3). Guesses, not facts:
# these investors stay confidence "low" until Phase 1 verifies them.
FRONTIER_TYPE_GUESSES = {
    "NVIDIA": "strategic",
    "Andreessen Horowitz": "vc",
    "Sequoia Capital": "vc",
    "Lightspeed Venture Partners": "vc",
    "BlackRock": "asset_manager",
    "Fidelity Investments": "asset_manager",
    "Microsoft": "strategic",
    "MGX": "sovereign",
    "Founders Fund": "vc",
    "Coatue": "asset_manager",
    "TPG": "asset_manager",
    "DST Global": "vc",
    "Cisco Investments": "cvc",
    "Cisco": "strategic",
    "Accel": "vc",
    "Conviction": "vc",
    "Jane Street": "strategic",
    "ServiceNow": "strategic",
    "Square Peg": "vc",
    "AMD Ventures": "cvc",
    "Alphabet": "strategic",
    "GV": "cvc",
    "Greenoaks": "vc",
    "NFDG Ventures": "vc",
    "General Catalyst": "vc",
    "Salesforce Ventures": "cvc",
    "Qatar Investment Authority": "sovereign",
    "Manhattan Venture Partners": "vc",
    "Valor Equity Partners": "asset_manager",
    "T. Rowe Price": "asset_manager",
    "Blackstone": "asset_manager",
    "IDG Capital": "vc",
    "Tencent": "strategic",
    "Legend Capital": "vc",
    "JD.com": "strategic",
    "Boyu Capital": "asset_manager",
    "Meituan": "strategic",
    "NetEase Games": "strategic",
    "CATL": "strategic",
    "Geely": "strategic",
    "Liang Wenfeng": "individual",
}

ROBOTICS_LIST = "startupriders_robotics_20m_plus_2026"
MEGASEED_LIST = "freesbee_ai_megaseeds_2026"

# The robotics list is about robotics companies; the mega-seed list gives no sector.
LIST_SECTOR = {ROBOTICS_LIST: "robotics_physical_ai"}


@dataclass
class SeedInvestorRow:
    name: str
    source_id: str
    listed_focus: str | None
    listed_check_or_fund: str | None
    notes: str | None


@dataclass
class SeedRound:
    company: str
    source_id: str
    amount_usd: int | None
    stage: str
    stage_raw: str
    description: str | None
    leads: list[str] = field(default_factory=list)
    participants: list[str] = field(default_factory=list)
    unspecified: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _blank_to_none(value: str | None) -> str | None:
    value = clean(value or "")
    return value or None


def read_seed_investors(path: Path = SEED_INVESTORS_CSV) -> list[SeedInvestorRow]:
    with path.open(encoding="utf-8", newline="") as fh:
        return [
            SeedInvestorRow(
                name=clean(row["name_as_listed"]),
                source_id=clean(row["source_id"]),
                listed_focus=_blank_to_none(row["listed_focus"]),
                listed_check_or_fund=_blank_to_none(row["listed_check_or_fund"]),
                notes=_blank_to_none(row["notes"]),
            )
            for row in csv.DictReader(fh)
            if clean(row["name_as_listed"])
        ]


# --- Physical-AI investor list (user, 2026-11-01) ------------------------------------------

PHYSICAL_AI_LIST = "physical_ai_investor_list_2026_11_01"
PHYSICAL_AI_RETRIEVED = "2026-11-01"
VC_INDIA_LIST = "vc_investing_in_india_list_2026_11_12"
VC_INDIA_RETRIEVED = "2026-11-12"
# When a list was received, if not the Phase 0 date (see atlas.model.user_source).
LIST_RETRIEVED = {PHYSICAL_AI_LIST: PHYSICAL_AI_RETRIEVED, VC_INDIA_LIST: VC_INDIA_RETRIEVED}
# The list's four groups, kept as `user_tags` (short, sentence case).
PHYSICAL_AI_TAGS = (
    "Robotics and hard-tech",
    "Emerging and specialist",
    "Big names",
    "Strategic and corporate",
)
# Names written with a note that the generic bracket rule would not turn into the firm.
PHYSICAL_AI_NAMES = {
    "MISUMI Americas (the new MISUMI Ventures fund)": "MISUMI Ventures",  # the fund, not MISUMI
}


@dataclass
class PhysicalAiRow:
    name_as_listed: str
    name: str  # the investing firm, as fed to the resolver
    tag: str


def physical_ai_name(raw: str) -> str:
    """'SOSV / SOSV HAX' -> SOSV; "M12 (Microsoft's venture fund)" -> M12."""
    raw = clean(raw)
    if raw in PHYSICAL_AI_NAMES:
        return PHYSICAL_AI_NAMES[raw]
    return investing_name(raw.split(" / ")[0]).name


def read_physical_ai(path: Path = PHYSICAL_AI_CSV) -> list[PhysicalAiRow]:
    with path.open(encoding="utf-8", newline="") as fh:
        rows = [
            PhysicalAiRow(clean(r["name"]), physical_ai_name(r["name"]), clean(r["group"]))
            for r in csv.DictReader(fh)
            if clean(r["name"])
        ]
    for r in rows:
        if r.tag not in PHYSICAL_AI_TAGS:
            raise ValueError(f"unknown group {r.tag!r} for {r.name_as_listed!r}")
    return rows


# --- "VC investing in India" list (user, 2026-11-12) ---------------------------------------

# The list has no name column: names are read from each web address (see the CSV notes).
VC_INDIA_TAG = "VC investing in India"


@dataclass
class VcIndiaRow:
    name: str
    url: str | None  # the firm's site, or a LinkedIn company page
    location: str | None
    focus: str | None
    about: str | None
    check: str | None
    note: str | None

    @property
    def link_field(self) -> str | None:
        """Investor field the listed URL fills: a LinkedIn page is not a website."""
        if not self.url:
            return None
        return "linkedin" if "linkedin.com/" in self.url else "website"

    def hint(self) -> dict:
        notes = [
            self.about if self.focus else None,
            f"Address as listed: {self.location}" if self.location else None,
            f"Web address as listed: {self.url}" if self.url else None,
            self.note,
        ]
        return {
            "source_id": VC_INDIA_LIST,
            "listed_focus": self.focus or self.about,
            "listed_check_or_fund": self.check,
            "notes": "; ".join(n for n in notes if n) or None,
        }


def read_vc_india(path: Path = VC_INDIA_CSV) -> list[VcIndiaRow]:
    with path.open(encoding="utf-8", newline="") as fh:
        return [
            VcIndiaRow(
                name=clean(r["name"]),
                url=_blank_to_none(r["website"]),
                location=_blank_to_none(r["location_as_listed"]),
                focus=_blank_to_none(r["focus_as_listed"]),
                about=_blank_to_none(r["about_as_listed"]),
                check=_blank_to_none(r["check_as_listed"]),
                note=_blank_to_none(r["note"]),
            )
            for r in csv.DictReader(fh)
            if clean(r["name"])
        ]


# Country codes that end an address on the list. US state codes ("NY", "MA") look the
# same, so only these are read as countries.
ADDRESS_COUNTRY_CODES = {"US", "GB", "CA", "AU", "LU", "DE", "IN", "SG", "AE", "QA"}


def region_from_address(address: str | None) -> str | None:
    """Region of the places a street address names, when they agree.

    Street parts and postcodes match no place and are skipped; a trailing two-letter
    part is a country code ("..., Mumbai, IN"). Places in several regions give None.
    """
    parts = [re.sub(r"[\d#]+", " ", p).strip(" -.") for p in (address or "").split(",")]
    regions = set()
    for i, part in enumerate(parts):
        if i == len(parts) - 1 and part in ADDRESS_COUNTRY_CODES:
            regions.add(region_for_country(part))
            continue
        # "London W S HR" (postcode letters), "California US", "Ontario M B B".
        part = re.sub(r"(\s+[A-Z]{1,3})+$", "", part)
        if region := region_for_location(part) or region_for_location(
            part.replace("United Kingdom", "UK")
        ):
            regions.add(region)
    return regions.pop() if len(regions) == 1 else None


def parse_amount(raw: str) -> int | None:
    """'1.7B' -> 1_700_000_000, '52M' -> 52_000_000."""
    m = re.fullmatch(r"\$?\s*([\d.]+)\s*([MB])", clean(raw), flags=re.IGNORECASE)
    if not m:
        return None
    scale = 1_000_000_000 if m.group(2).upper() == "B" else 1_000_000
    return round(float(m.group(1)) * scale)


def parse_names(raw: str) -> tuple[list[str], list[str]]:
    """Semicolon-separated investor names, plus notes for text that isn't a name."""
    names, notes = [], []
    for part in (clean(p) for p in (raw or "").split(";")):
        if not part:
            continue
        if part.lower() == "undisclosed":
            notes.append("lead not disclosed in the list")
            continue
        m = re.fullmatch(r"(.+?)\s*\((\+\d+ co-leads?)\)", part)
        if m:
            names.append(m.group(1))
            notes.append(f"{m.group(2)} not named in the list")
            continue
        names.append(part)
    return names, notes


def stage_from_label(label: str) -> str:
    return "seed" if re.search(r"(?i)\bseed\b", label) else "undisclosed"


def read_seed_rounds(path: Path = SEED_ROUNDS_CSV) -> list[SeedRound]:
    rounds = []
    with path.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            source_id = clean(row["source_id"])
            first, first_notes = parse_names(row["lead_or_investors"])
            co, co_notes = parse_names(row["co_investors"])
            r = SeedRound(
                company=clean(row["company"]),
                source_id=source_id,
                amount_usd=parse_amount(row["amount_usd_as_listed"]),
                stage=stage_from_label(row["round_as_listed"]),
                stage_raw=clean(row["round_as_listed"]),
                description=_blank_to_none(row["description"]),
                notes=first_notes + co_notes,
            )
            # The mega-seed list names leads, then strategic co-investors. The
            # robotics list names investors without saying who led.
            if source_id == MEGASEED_LIST:
                r.leads, r.participants = first, co
            else:
                r.unspecified = first + co
            if not first and not co and not r.notes:
                r.notes.append("no investors listed")
            rounds.append(r)
    return rounds
