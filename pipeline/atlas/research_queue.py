"""Research tiers and the research queue (PHASE_1 §4.2).

    uv run python -m atlas.research_queue

Scores every Phase 0 investor plus the Phase 1 candidate list, cuts Tier A
(Western and India) and Tier B, and writes data/research/queue.json. Status and
last_touched of existing entries are kept, so re-running never loses progress.
"""

import csv
import json
import re
import sys
from dataclasses import dataclass, field
from datetime import date

from rapidfuzz import fuzz, process

from atlas import names
from atlas.config import FRESHNESS_CUTOFF, RESEARCH, SEED_DIR
from atlas.model import Store

QUEUE_PATH = RESEARCH / "queue.json"
CANDIDATES_CSV = SEED_DIR / "phase1_candidates.csv"

TIER_A_WESTERN_MIN, TIER_A_WESTERN_MAX = 60, 80
TIER_A_WESTERN_TARGET = 70
TIER_A_INDIA = 10
TIER_B_SIZE = 200

INDUSTRIAL_RE = re.compile(
    r"(?i)industrial|manufactur|robot|hardware|deep ?tech|supply chain|logistics|defen[cs]e|"
    r"physical ai|embodied|automation|hard ?tech"
)
AI_RE = re.compile(r"(?i)\bai\b|artificial intelligence|machine learning|\bml\b|agents?\b")
EARLY_RE = re.compile(r"(?i)pre-?seed|\bseed\b|early")
FRESH_RE = re.compile(r"(?i)\b2026\b|q[1-4] 2026|2025")

EARLY_CATEGORIES = {
    "industrial_hard_tech_physical_ai",
    "ai_first_b2b_seed",
    "accelerator_platform",
    "cross_border_immigrant_friendly",
    "india",
}


@dataclass
class Candidate:
    name: str
    investor_id: str | None
    region: str | None
    hints: list[str] = field(default_factory=list)
    lists: set[str] = field(default_factory=set)
    categories: set[str] = field(default_factory=set)
    goldman_fund: bool = False
    fresh_fund: bool = False
    backed_robotics_or_competitor: bool = False
    flagged_late_stage: bool = False
    latest_fund_year: int = 0
    latest_close: int = 0  # YYYYMMDD of the most recent fund close
    latest_fund_usd: float = 0
    score: int = 0
    reasons: list[str] = field(default_factory=list)


def read_candidates() -> list[dict]:
    with CANDIDATES_CSV.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def collect(store: Store) -> list[Candidate]:
    out: dict[str, Candidate] = {}
    robotics_backers = set()
    for r in store.rounds.values():
        if any("robotics" in s["url"] for s in r["sources"]):
            robotics_backers.update(
                r["lead_investor_ids"]
                + r["participant_investor_ids"]
                + r["unspecified_investor_ids"]
            )

    funds_by_inv: dict[str, list[dict]] = {}
    for f in store.funds.values():
        funds_by_inv.setdefault(f["investor_id"], []).append(f)

    for inv in store.investors.values():
        c = Candidate(inv["name"], inv["id"], inv["region"])
        for h in inv["seed_hints"]:
            c.hints += [v for v in (h["listed_focus"], h["listed_check_or_fund"], h["notes"]) if v]
        c.lists = set(inv["seed_source_ids"])
        funds = funds_by_inv.get(inv["id"], [])
        c.goldman_fund = bool(funds)
        c.fresh_fund = any((f["close_date"] or "") >= FRESHNESS_CUTOFF for f in funds)
        c.latest_fund_year = max((f["vintage_year"] or 0 for f in funds), default=0)
        if funds:
            latest = max(funds, key=lambda f: (f["close_date"] or "", f["size_usd"] or 0))
            digits = (latest["close_date"] or "").replace("-", "")
            c.latest_close = int(digits.ljust(8, "0")) if digits.isdigit() else 0
            c.latest_fund_usd = latest["size_usd"] or 0
        c.backed_robotics_or_competitor = inv["id"] in robotics_backers
        c.flagged_late_stage = "not_early_stage_target_by_default" in inv["flags"]
        out[inv["id"]] = c

    # Match Phase 1 candidates to existing investors by name key, else add them.
    keyed = {}
    for inv in store.investors.values():
        for n in [inv["name"], *inv["aliases"]]:
            keyed.setdefault(names.match_key(n), inv["id"])
    for row in read_candidates():
        key = names.match_key(row["name"])
        inv_id = keyed.get(key)
        if inv_id is None:
            hit = process.extractOne(
                key, list(keyed), scorer=fuzz.token_sort_ratio, score_cutoff=92
            )
            inv_id = keyed[hit[0]] if hit else None
        c = out.get(inv_id) if inv_id else None
        if c is None:
            c = Candidate(row["name"], None, row["region_hint"] or None)
            out[f"candidate:{key}"] = c
        if c.region is None and row["region_hint"]:
            c.region = row["region_hint"]
        c.lists.add("phase1_candidates")
        c.categories.add(row["category"])
    return list(out.values())


def score(c: Candidate) -> None:
    text = " ".join(c.hints)
    early = (
        c.goldman_fund or bool(EARLY_RE.search(text)) or bool(c.categories & EARLY_CATEGORIES)
    ) and not c.flagged_late_stage
    points = []
    # PHASE_1 §4.2 gives +3 to Western early-stage. India is ranked separately for
    # its own Tier A slice, so the same point goes to India early-stage there.
    if c.region in ("western", "india") and early:
        points.append((3, f"{c.region} early-stage"))
    if INDUSTRIAL_RE.search(text) or "industrial_hard_tech_physical_ai" in c.categories:
        points.append((3, "industrial / hard-tech signal"))
    if c.backed_robotics_or_competitor or "competitor_investor" in c.categories:
        points.append((2, "backed a competitor or robotics-list company"))
    if c.fresh_fund or FRESH_RE.search(text):
        points.append((2, "fund closed since the freshness cutoff"))
    extra_lists = min(3, max(0, len(c.lists) - 1))
    if extra_lists:
        points.append((extra_lists, f"on {len(c.lists)} lists"))
    if AI_RE.search(text) or "ai_first_b2b_seed" in c.categories:
        points.append((1, "AI-first signal"))
    c.score = sum(p for p, _ in points)
    c.reasons = [r for _, r in points]


def rank_key(c: Candidate) -> tuple:
    """Score, then more lists, then most recent fund close, then bigger fund, then name."""
    return (-c.score, -len(c.lists), -c.latest_close, -c.latest_fund_usd, c.name.lower())


def cut_western(ranked: list[Candidate]) -> int:
    """Tier A size: the first score break between 60 and 80, else 70."""
    for size in range(TIER_A_WESTERN_MIN, TIER_A_WESTERN_MAX + 1):
        if size < len(ranked) and ranked[size - 1].score != ranked[size].score:
            return size
    return min(TIER_A_WESTERN_TARGET, len(ranked))


def assign_tiers(cands: list[Candidate]) -> dict[str, list[Candidate]]:
    for c in cands:
        score(c)
    eligible = [c for c in cands if c.score > 0]
    western = sorted((c for c in eligible if c.region == "western"), key=rank_key)
    india = sorted((c for c in eligible if c.region == "india"), key=rank_key)
    a_size = cut_western(western)
    tier_a = western[:a_size] + india[:TIER_A_INDIA]
    rest = sorted(
        [c for c in western[a_size:] + india[TIER_A_INDIA:]]
        + [c for c in eligible if c.region not in ("western", "india", "other")],
        key=rank_key,
    )
    return {"A": tier_a, "B": rest[:TIER_B_SIZE]}


def build_queue(store: Store, today: str | None = None) -> dict:
    today = today or date.today().isoformat()
    old = {}
    if QUEUE_PATH.exists():
        old = {e["key"]: e for e in json.loads(QUEUE_PATH.read_text(encoding="utf-8"))["entries"]}
    tiers = assign_tiers(collect(store))
    entries = []
    for tier, members in tiers.items():
        for c in members:
            key = names.tokens(c.name) and "-".join(names.tokens(c.name))
            prev = old.get(key, {})
            entries.append(
                {
                    "key": key,
                    "entity_type": "investor",
                    "name": c.name,
                    "investor_id": c.investor_id,
                    "tier": prev.get("tier")
                    if prev.get("status") in ("done", "in_progress")
                    else tier,
                    "score": c.score,
                    "status": prev.get("status", "todo"),
                    "blocked_reason": prev.get("blocked_reason"),
                    "last_touched": prev.get("last_touched"),
                }
            )
    # Non-investor research tasks keep whatever is already queued.
    entries += [e for e in old.values() if e["entity_type"] != "investor"]
    return {
        "updated_at": today,
        "entries": entries,
        "_reasons": {"-".join(names.tokens(c.name)): c.reasons for m in tiers.values() for c in m},
    }


def write_queue(queue: dict) -> None:
    QUEUE_PATH.parent.mkdir(parents=True, exist_ok=True)
    reasons = queue.pop("_reasons")
    QUEUE_PATH.write_text(
        json.dumps(queue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n"
    )
    lines = ["# Research tiers", "", "Generated by `uv run python -m atlas.research_queue`.", ""]
    for tier in ("A", "B"):
        members = [
            e for e in queue["entries"] if e["tier"] == tier and e["entity_type"] == "investor"
        ]
        lines += [
            f"## Tier {tier} ({len(members)})",
            "",
            "| # | Name | Score | Why |",
            "|---|---|---|---|",
        ]
        for i, e in enumerate(members, 1):
            lines.append(
                f"| {i} | {e['name']} | {e['score']} | {'; '.join(reasons.get(e['key'], []))} |"
            )
        lines.append("")
    (QUEUE_PATH.parent / "TIERS.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")


def main() -> int:
    from atlas import run

    store = Store()
    run.run(store, research=False)
    queue = build_queue(store)
    write_queue(queue)
    counts = {}
    for e in queue["entries"]:
        counts[e["tier"]] = counts.get(e["tier"], 0) + 1
    print("queue written:", counts)
    return 0


if __name__ == "__main__":
    sys.exit(main())
