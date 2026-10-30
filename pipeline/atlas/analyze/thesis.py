"""Thesis vectors (PHASE_1 §8): 0.5 × stated thesis + 0.5 × portfolio sector share.

Stated: the sectors the firm names (research `stated_sectors`), else keyword hits
in its thesis text and the user lists' focus (THESIS_KEYWORDS). Portfolio:
sectors of companies in its rounds, rounds in the last 24 months weighted 1.0,
older 0.5. If one input is missing the other is used alone; `method` says which.
A portfolio needs MIN_PORTFOLIO_ROUNDS rounds with a known sector to count: one
industrial co-investment is not an industrial thesis.
"""

import math
from datetime import date

from atlas.config import (
    AGNOSTIC_PHRASES,
    GENERALIST_ENTROPY,
    MIN_PORTFOLIO_ROUNDS,
    REFERENCE_DATE,
    SECTORS,
    THESIS_KEYWORDS,
)
from atlas.model import Store

RECENT_DAYS = 730


def _normalise(weights: dict[str, float]) -> dict[str, float]:
    total = sum(weights.values())
    return {k: v / total for k, v in sorted(weights.items()) if v > 0} if total > 0 else {}


def stated_vector(store: Store, inv: dict) -> tuple[dict[str, float], list[str]]:
    sectors = store.stated_sectors.get(inv["id"])
    if sectors:
        return _normalise({s: 1.0 for s in sectors}), [f"stated_sectors: {', '.join(sectors)}"]
    text = " ".join(
        [inv["thesis_text"] or ""] + [h["listed_focus"] or "" for h in inv["seed_hints"]]
    ).lower()
    if not text.strip():
        return {}, []
    hits = {}
    log = []
    for sector, phrases in THESIS_KEYWORDS.items():
        found = [p.strip() for p in phrases if p in f" {text} "]
        if found:
            hits[sector] = float(len(found))
            log.append(f"{sector}: {', '.join(found)}")
    return _normalise(hits), [f"keywords — {'; '.join(log)}"] if log else []


def portfolio_vector(
    store: Store, inv_id: str, rounds_by_investor: dict
) -> tuple[dict[str, float], int]:
    ref = date.fromisoformat(REFERENCE_DATE)
    weights: dict[str, float] = {}
    counted = 0
    for r in rounds_by_investor.get(inv_id, []):
        co = store.companies.get(r["company_id"]) or store.competitors.get(r["company_id"])
        if not co or not co["sector"]:
            continue
        recent = False
        if r["date"]:
            year = int(r["date"][:4])
            month = int(r["date"][5:7]) if len(r["date"]) >= 7 and r["date"][5] != "Q" else 6
            recent = (ref - date(year, month, 1)).days <= RECENT_DAYS
        weights[co["sector"]] = weights.get(co["sector"], 0.0) + (1.0 if recent else 0.5)
        counted += 1
    return _normalise(weights), counted


def normalised_entropy(weights: dict[str, float]) -> float:
    ps = [p for p in weights.values() if p > 0]
    if len(ps) <= 1:
        return 0.0
    return -sum(p * math.log(p) for p in ps) / math.log(len(SECTORS))


def rounds_index(store: Store) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for r in store.rounds.values():
        for inv_id in (
            r["lead_investor_ids"] + r["participant_investor_ids"] + r["unspecified_investor_ids"]
        ):
            out.setdefault(inv_id, []).append(r)
    return out


def compute(store: Store) -> None:
    by_inv = rounds_index(store)
    for inv in store.investors.values():
        stated, stated_inputs = stated_vector(store, inv)
        portfolio, n = portfolio_vector(store, inv["id"], by_inv)
        if n < MIN_PORTFOLIO_ROUNDS:
            portfolio = {}
        if stated and portfolio:
            sectors = set(stated) | set(portfolio)
            value = {s: 0.5 * stated.get(s, 0) + 0.5 * portfolio.get(s, 0) for s in sectors}
            method = "stated_and_portfolio"
        elif stated or portfolio:
            value, method = (stated, "stated_only") if stated else (portfolio, "portfolio_only")
        else:
            continue
        value = {k: round(v, 6) for k, v in sorted(value.items())}
        # Re-normalise after rounding so weights still sum to 1.
        drift = 1 - sum(value.values())
        top = max(value, key=value.get)
        value[top] = round(value[top] + drift, 6)
        inputs = stated_inputs + (
            [
                f"portfolio: {n} rounds with a known sector"
                + ("" if portfolio else f" (fewer than {MIN_PORTFOLIO_ROUNDS}, not used)")
            ]
            if n
            else []
        )
        inv["sector_weights"] = {"value": value, "method": method, "inputs": inputs}
        agnostic = any(p in (inv["thesis_text"] or "").lower() for p in AGNOSTIC_PHRASES)
        inv["category"]["is_generalist"] = (
            agnostic or normalised_entropy(value) >= GENERALIST_ENTROPY
        )
