"""Thesis clusters and the 2D thesis map (PHASE_1 §8).

k-means on non-generalist thesis vectors, k in [4, 10] chosen by silhouette;
generalists take the nearest centroid for colour only. 2D layout by UMAP, or
PCA when there are too few investors for UMAP. Seeded throughout.
"""

import warnings

import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

from atlas.config import CLUSTER_K_RANGE, RANDOM_STATE, SECTORS
from atlas.model import Store

MIN_FOR_UMAP = 30


def _matrix(investors: list[dict]) -> np.ndarray:
    return np.array(
        [[inv["sector_weights"]["value"].get(s, 0.0) for s in SECTORS] for inv in investors]
    )


def _name(centroid: np.ndarray) -> tuple[str, list[dict]]:
    order = np.argsort(-centroid)[:3]
    top = [
        {"sector": SECTORS[i], "weight": round(float(centroid[i]), 4)}
        for i in order
        if centroid[i] > 0
    ]
    label = " · ".join(t["sector"].replace("_", " ") for t in top)
    return label, top


def compute(store: Store) -> tuple[list[dict], list[dict]]:
    """Returns (thesis points, clusters)."""
    with_vectors = sorted(
        (i for i in store.investors.values() if i["sector_weights"]), key=lambda i: i["id"]
    )
    if len(with_vectors) < 3:
        return [], []
    core = [i for i in with_vectors if not i["category"]["is_generalist"]]
    lo, hi = CLUSTER_K_RANGE
    hi = min(hi, len(core) - 1)
    best = None
    if len(core) > lo:
        x = _matrix(core)
        for k in range(lo, hi + 1):
            km = KMeans(n_clusters=k, n_init=10, random_state=RANDOM_STATE).fit(x)
            if len(set(km.labels_)) < 2:
                continue
            score = silhouette_score(x, km.labels_)
            if best is None or score > best[0] + 1e-12:
                best = (score, k, km)

    clusters = []
    if best:
        _, k, km = best
        centroids = km.cluster_centers_
        labels_all = km.predict(_matrix(with_vectors))
        for idx, inv in enumerate(with_vectors):
            inv["category"]["cluster_id"] = int(labels_all[idx])
        for c in range(k):
            name, top = _name(centroids[c])
            clusters.append(
                {
                    "id": f"cl_{c}",
                    "index": c,
                    "name": name,
                    "size": int((labels_all == c).sum()),
                    "top_sectors": top,
                }
            )

    x_all = _matrix(with_vectors)
    if len(with_vectors) >= MIN_FOR_UMAP:
        import umap  # slow import; only when used

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            coords = umap.UMAP(
                n_neighbors=min(15, len(with_vectors) - 1), random_state=RANDOM_STATE, n_jobs=1
            ).fit_transform(x_all)
    else:
        coords = PCA(n_components=2, random_state=RANDOM_STATE).fit_transform(x_all)
    points = [
        {
            "id": inv["id"],
            "x": round(float(coords[i][0]), 6),
            "y": round(float(coords[i][1]), 6),
            "cluster_id": inv["category"]["cluster_id"],
            "is_generalist": bool(inv["category"]["is_generalist"]),
        }
        for i, inv in enumerate(with_vectors)
    ]
    return points, clusters
