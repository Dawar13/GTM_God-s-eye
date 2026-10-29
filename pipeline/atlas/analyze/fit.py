"""Fit features, each 0–1 (PHASE_1 §8; weights and total are applied in the app).

thesis      industrial affinity + 0.5 × AI weight, clamped
stage       1.0 pre-seed, 0.8 seed, 0.4 Series A only, 0.1 later only
check       1.0 when our raise sits inside the check range; leads +0.2
adjacency   1 − exp(−n / 3), n = recency-weighted portfolio companies in our or neighbouring layers
geography   western 0.7 (+0.3 if it backs Indian founders); india 0.6; other 0.2
dry_powder  fresh fund 1.0 / older 0.4, × fund-size fit for a pre-seed round

Flags: conflict = backed a direct competitor in the last 24 months; sparse =
more than 40% of the six features unknown.
"""

import math
from datetime import date

from atlas.analyze.categorize import latest_fund
from atlas.config import NEIGHBOUR_LAYERS, OUR_LAYERS, RAISE_SIZE_USD, REFERENCE_DATE
from atlas.model import Store

FEATURES = ("thesis", "stage", "check", "adjacency", "geography", "dry_powder")
SPARSE_SHARE = 0.4
RECENT_DAYS = 730


def _feature(value: float, method: str, inputs: list[str]) -> dict:
    return {"value": round(max(0.0, min(1.0, value)), 6), "method": method, "inputs": inputs}


def _recent(d: str | None) -> bool:
    if not d:
        return False
    y = int(d[:4])
    m = int(d[5:7]) if len(d) >= 7 and d[5] != "Q" else 6
    return (date.fromisoformat(REFERENCE_DATE) - date(y, m, 1)).days <= RECENT_DAYS


def thesis(inv: dict) -> dict | None:
    sw = inv["sector_weights"]
    aff = inv["category"]["industrial_affinity"]
    if not sw or not aff:
        return None
    ai = sw["value"].get("ai_infra", 0) + sw["value"].get("ai_apps_agents", 0)
    return _feature(
        aff["value"] + 0.5 * ai,
        "industrial affinity + 0.5 × AI weight",
        [f"industrial_affinity {aff['value']:.2f}", f"ai weight {ai:.2f}"],
    )


def stage(inv: dict) -> dict | None:
    s = set(inv["stages"])
    if not s:
        return None
    value = 1.0 if "pre_seed" in s else 0.8 if "seed" in s else 0.4 if "series_a" in s else 0.1
    return _feature(value, "earliest stage vs our pre-seed", [f"stages: {', '.join(sorted(s))}"])


def check(inv: dict) -> dict | None:
    lo, hi = inv["check_min_usd"], inv["check_max_usd"]
    if lo is None and hi is None:
        return None
    raise_ = RAISE_SIZE_USD
    if lo is not None and lo > raise_:
        value = 0.0  # their minimum check is bigger than our whole round
    elif hi is not None and hi < 0.05 * raise_:
        value = 0.3  # tiny checks: fine as a participant
    else:
        value = 1.0 if (hi is None or hi <= raise_) else 0.8
    if inv["leads"]:
        value += 0.2
    return _feature(
        value,
        f"check range vs raise of ${raise_:,.0f} (assumption); leads +0.2",
        [f"check {lo}–{hi}", f"leads {inv['leads']}"],
    )


def adjacency(inv_id: str, store: Store, rounds_by_inv: dict) -> dict | None:
    rounds = rounds_by_inv.get(inv_id, [])
    if not rounds:
        return None
    n = 0.0
    seen = set()
    for r in rounds:
        co = store.companies.get(r["company_id"]) or store.competitors.get(r["company_id"])
        if not co or co["id"] in seen:
            continue
        layer = co.get("layer")
        sector = co.get("sector")
        if layer in OUR_LAYERS or layer in NEIGHBOUR_LAYERS or sector == "industrial_manufacturing":
            seen.add(co["id"])
            n += 1.0 if _recent(r["date"]) else 0.5
    return _feature(
        1 - math.exp(-n / 3),
        "1 − exp(−n/3), n = recency-weighted adjacent companies",
        [f"{len(seen)} adjacent companies in {len(rounds)} rounds"],
    )


def geography(inv: dict) -> dict | None:
    region = inv["region"]
    if region is None:
        return None
    value = {"western": 0.7, "india": 0.6, "other": 0.2}[region]
    if region == "western" and inv["invests_in_indian_founders"] == "yes":
        value += 0.3
    return _feature(
        value,
        "region, + cross-border signal",
        [f"region {region}", f"Indian founders {inv['invests_in_indian_founders']}"],
    )


def dry_powder(inv: dict, funds: list[dict]) -> dict | None:
    fresh = inv["category"]["freshness"]
    if fresh in (None, "unknown"):
        return None
    latest = latest_fund(funds)
    size = latest["size_usd"] if latest else None
    fit = 1.0 if size is None or size <= 300e6 else 0.7 if size <= 1e9 else 0.4
    return _feature(
        (1.0 if fresh == "fresh" else 0.4) * fit,
        "freshness × fund-size fit for pre-seed",
        [f"freshness {fresh}", f"latest fund {size}"],
    )


def conflict(inv_id: str, store: Store, rounds_by_inv: dict) -> bool:
    for r in rounds_by_inv.get(inv_id, []):
        co = store.competitors.get(r["company_id"])
        if co and co["category"] == "direct" and _recent(r["date"]):
            return True
    return False


def compute(store: Store, rounds_by_inv: dict) -> list[dict]:
    funds_by_inv: dict[str, list[dict]] = {}
    for f in store.funds.values():
        funds_by_inv.setdefault(f["investor_id"], []).append(f)
    out = []
    for inv in sorted(store.investors.values(), key=lambda i: i["id"]):
        feats = {
            "thesis": thesis(inv),
            "stage": stage(inv),
            "check": check(inv),
            "adjacency": adjacency(inv["id"], store, rounds_by_inv),
            "geography": geography(inv),
            "dry_powder": dry_powder(inv, funds_by_inv.get(inv["id"], [])),
        }
        known = sum(v is not None for v in feats.values())
        if known == 0:
            continue
        flags = []
        if conflict(inv["id"], store, rounds_by_inv):
            flags.append("conflict")
        if (len(FEATURES) - known) / len(FEATURES) > SPARSE_SHARE:
            flags.append("sparse")
        out.append(
            {
                "id": f"fit_{inv['id'][4:]}",
                "investor_id": inv["id"],
                "features": feats,
                "flags": flags,
                "raise_size_usd": RAISE_SIZE_USD,
            }
        )
    return out
