"""Investor × competitor overlap (PHASE_1 §8)."""

from atlas.model import Store


def compute(store: Store, generated_at: str, version: int) -> dict:
    rows: dict[str, dict] = {}
    for r in sorted(store.rounds.values(), key=lambda x: x["id"]):
        if r["company_id"] not in store.competitors:
            continue
        for inv_id in (
            r["lead_investor_ids"] + r["participant_investor_ids"] + r["unspecified_investor_ids"]
        ):
            row = rows.setdefault(
                inv_id,
                {"investor_id": inv_id, "competitor_ids": [], "round_ids": [], "latest_date": None},
            )
            if r["company_id"] not in row["competitor_ids"]:
                row["competitor_ids"].append(r["company_id"])
            row["round_ids"].append(r["id"])
            if r["date"] and (row["latest_date"] is None or r["date"] > row["latest_date"]):
                row["latest_date"] = r["date"]
    for row in rows.values():
        row["competitor_ids"].sort()
    return {
        "version": version,
        "generated_at": generated_at,
        "competitor_ids": sorted(store.competitors),
        "rows": sorted(rows.values(), key=lambda x: (-len(x["competitor_ids"]), x["investor_id"])),
    }
