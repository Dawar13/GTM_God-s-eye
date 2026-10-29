"""Industrial affinity, stage earliness and the capital-bubbles axes (PROJECT_CONTEXT §4)."""

import math

from atlas.analyze.categorize import latest_fund
from atlas.config import STAGE_SCORES
from atlas.model import Store

CORE = ("industrial_manufacturing", "robotics_physical_ai")
HALF = ("hardware_deeptech", "supply_chain_logistics", "mobility_ev")


def industrial_affinity(weights: dict[str, float]) -> float:
    raw = sum(weights.get(s, 0) for s in CORE) + 0.5 * sum(weights.get(s, 0) for s in HALF)
    return max(0.0, min(1.0, raw))


def stage_earliness(stages: list[str]) -> float | None:
    scores = [STAGE_SCORES[s] for s in stages if s in STAGE_SCORES]
    return sum(scores) / len(scores) if scores else None


def typical_check(lo: float | None, hi: float | None) -> float | None:
    if lo and hi:
        return math.sqrt(lo * hi)
    return lo or hi or None


def compute(store: Store) -> list[dict]:
    funds_by_inv: dict[str, list[dict]] = {}
    for f in store.funds.values():
        funds_by_inv.setdefault(f["investor_id"], []).append(f)
    points = []
    for inv in store.investors.values():
        cat = inv["category"]
        sw = inv["sector_weights"]
        if sw:
            cat["industrial_affinity"] = {
                "value": round(industrial_affinity(sw["value"]), 6),
                "method": "core + 0.5 × adjacent sector weights, clamped 0–1",
                "inputs": [f"sector_weights ({sw['method']})"],
            }
        earliness = stage_earliness(inv["stages"])
        if earliness is not None:
            cat["stage_earliness"] = {
                "value": round(earliness, 6),
                "method": "mean of stage scores",
                "inputs": [f"stages: {', '.join(inv['stages'])}"],
            }
        latest = latest_fund(funds_by_inv.get(inv["id"], []))
        check = typical_check(inv["check_min_usd"], inv["check_max_usd"])
        if not (sw or earliness is not None or check or (latest and latest["size_usd"])):
            continue
        points.append(
            {
                "id": inv["id"],
                "typical_check_usd": round(check) if check else None,
                "stage_earliness": cat["stage_earliness"]["value"]
                if cat["stage_earliness"]
                else None,
                "industrial_affinity": cat["industrial_affinity"]["value"]
                if cat["industrial_affinity"]
                else None,
                "latest_fund_usd": latest["size_usd"] if latest else None,
                "colour_key": f"cl_{cat['cluster_id']}" if cat["cluster_id"] is not None else None,
            }
        )
    return points
