"""Run the pipeline: ingest -> resolve -> build -> export.

pnpm pipeline                (from the repo root)
uv run python -m atlas.run   (from pipeline/)
"""

import sys

from atlas import build
from atlas.export.write_json import DATASET_NAMES, now_iso, write_dataset
from atlas.geo import region_for_location
from atlas.ingest import goldman_pdf, seeds
from atlas.model import Store
from atlas.names import firm_from_fund_name
from atlas.resolve import InvestorResolver


def ingest_seed_investors(resolver: InvestorResolver) -> int:
    rows = seeds.read_seed_investors()
    for row in rows:
        group = resolver.add(row.name, "seed_list", row.source_id)
        group.seed_hints.append(
            {
                "source_id": row.source_id,
                "listed_focus": row.listed_focus,
                "listed_check_or_fund": row.listed_check_or_fund,
                "notes": row.notes,
            }
        )
        if row.source_id == seeds.FRONTIER_LIST:
            group.on_frontier_list = True
            group.type_guess = group.type_guess or seeds.FRONTIER_TYPE_GUESSES.get(row.name)
        if row.source_id in seeds.REGION_SCOPED_LISTS:
            group.region_hints.add(seeds.REGION_SCOPED_LISTS[row.source_id])
        # A note that is only a place ("India; 28 pre-seed deals/yr") gives the region.
        if row.notes and (region := region_for_location(row.notes.split(";")[0])):
            group.region_hints.add(region)
    return len(rows)


def ingest_seed_rounds(resolver: InvestorResolver) -> list[build.RoundInput]:
    inputs = []
    for r in seeds.read_seed_rounds():
        roles = [
            (role, resolver.add(name, "round_list", r.source_id))
            for role, names in (
                ("lead", r.leads),
                ("participant", r.participants),
                ("unspecified", r.unspecified),
            )
            for name in names
        ]
        inputs.append(build.RoundInput(r, roles))
    return inputs


def run(store: Store) -> dict[str, int]:
    """Fill the store from every source. Returns extra counts for the summary."""
    resolver = InvestorResolver()

    funds, fallbacks = goldman_pdf.parse_pdf()
    goldman_pdf.write_interim(funds)
    goldman = []
    for fund in funds:
        firm = firm_from_fund_name(fund.fund_name)
        group = resolver.add(firm.name, "fund_list", goldman_pdf.SOURCE_ID, firm.aliases)
        goldman.append((fund, group))

    seed_rows = ingest_seed_investors(resolver)
    round_inputs = ingest_seed_rounds(resolver)

    duplicate_rounds = build.build(store, resolver, goldman, round_inputs)

    regions = build.region_counts(store)
    investors = store.investors.values()
    return {
        "goldman rows": len(funds),
        "goldman text-fallback pages": len(fallbacks),
        "seed investor rows": seed_rows,
        "seed round rows": len(round_inputs),
        "round listings merged": duplicate_rounds,
        "investors on 2+ seed lists": sum(1 for i in investors if i["seed_list_count"] >= 2),
        "investors seed + fund list": sum(
            1 for i in investors if i["seed_list_count"] and i["funds"]
        ),
        "investors western": regions["western"],
        "investors india": regions["india"],
        "investors other": regions["other"],
        "investors region unknown": regions["unknown"],
    }


def export(store: Store) -> dict[str, int]:
    generated_at = now_iso()
    collections = {
        "investors": list(store.investors.values()),
        "funds": list(store.funds.values()),
        "companies": list(store.companies.values()),
        "competitors": list(store.competitors.values()),
        "rounds": list(store.rounds.values()),
        "anomalies": store.anomalies,
        "merges": store.merges,
    }
    for name in DATASET_NAMES:
        write_dataset(name, collections[name], generated_at)
    return {name: len(collections[name]) for name in DATASET_NAMES}


def print_summary(counts: dict[str, int], extras: dict[str, int]) -> None:
    width = max(len(k) for k in [*counts, *extras])
    rule = "-" * (width + 10)
    print("\nCapital Atlas pipeline", rule, sep="\n")
    for key, value in counts.items():
        print(f"{key:<{width}}  {value:>6}")
    if extras:
        print(rule)
        for key, value in extras.items():
            print(f"{key:<{width}}  {value:>6}")
    print()


def main() -> int:
    store = Store()
    extras = run(store)
    counts = export(store)
    print_summary(counts, extras)
    return 0


if __name__ == "__main__":
    sys.exit(main())
