"""Phase 1 analytics: categories, thesis vectors, clusters, axes, graph, overlap, fit."""

from atlas.analyze import axes, categorize, cluster, competitors, fit, graph, thesis
from atlas.model import Store


def run_all(store: Store, generated_at: str, version: int) -> dict:
    """Fills derived fields on investors and returns the analytics outputs."""
    categorize.categorize(store)
    thesis.compute(store)
    points, clusters = cluster.compute(store)
    bubbles = axes.compute(store)
    rounds_by_inv = thesis.rounds_index(store)
    store.fit_features = fit.compute(store, rounds_by_inv)
    return {
        "layout_thesis": points,
        "clusters": clusters,
        "layout_bubbles": bubbles,
        "graph": graph.compute(store, generated_at, version),
        "competitor_overlap": competitors.compute(store, generated_at, version),
    }
