"""Run the pipeline: ingest -> resolve -> build -> export.

pnpm pipeline                (from the repo root)
uv run python -m atlas.run   (from pipeline/)
"""

import sys

from atlas import build
from atlas.export.write_json import DATASET_NAMES, now_iso, write_dataset
from atlas.ingest import goldman_pdf
from atlas.model import Store
from atlas.names import firm_from_fund_name
from atlas.resolve import InvestorResolver


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

    build.build(store, resolver, goldman)

    regions = build.region_counts(store)
    return {
        "goldman rows": len(funds),
        "goldman text-fallback pages": len(fallbacks),
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
