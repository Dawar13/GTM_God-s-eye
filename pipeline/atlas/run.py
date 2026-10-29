"""Run the pipeline: ingest -> export.

pnpm pipeline            (from the repo root)
uv run python -m atlas.run   (from pipeline/)
"""

import sys

from atlas.export.write_json import DATASET_NAMES, now_iso, write_dataset
from atlas.model import Store


def ingest(store: Store) -> dict[str, int]:
    """Fill the store from every source. Returns extra counts for the summary."""
    return {}


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
    rows = [*counts.items(), *extras.items()]
    width = max(len(k) for k, _ in rows)
    print("\nCapital Atlas pipeline")
    print("-" * (width + 10))
    for key, value in counts.items():
        print(f"{key:<{width}}  {value:>6}")
    if extras:
        print("-" * (width + 10))
        for key, value in extras.items():
            print(f"{key:<{width}}  {value:>6}")
    print()


def main() -> int:
    store = Store()
    extras = ingest(store)
    counts = export(store)
    print_summary(counts, extras)
    return 0


if __name__ == "__main__":
    sys.exit(main())
