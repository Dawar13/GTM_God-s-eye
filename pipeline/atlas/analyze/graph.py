"""Investor ↔ company graph and its metrics (PROJECT_CONTEXT §4, PHASE_1 §8).

Nodes: investors and companies that appear in at least one round. Edges: one
per (investor, round) with the investor's role. Metrics on the bipartite graph:
degree, weighted degree (rounds, leads count 1.5), normalised betweenness (for
"connector" investors). VC↔VC co-investment edges where two investors share at
least two rounds. Positions are filled by scripts/layout-graph.ts.
"""

from itertools import combinations

import networkx as nx

from atlas.model import Store

LEAD_WEIGHT = 1.5
MIN_SHARED_ROUNDS = 2


def compute(store: Store, generated_at: str, version: int) -> dict:
    g = nx.Graph()
    edges = []
    per_round: dict[str, set[str]] = {}
    for r in sorted(store.rounds.values(), key=lambda x: x["id"]):
        for role in ("lead", "participant", "unspecified"):
            for inv_id in r[f"{role}_investor_ids"]:
                edges.append(
                    {
                        "source": inv_id,
                        "target": r["company_id"],
                        "round_id": r["id"],
                        "role": role,
                        "stage": r["stage"],
                        "amount_usd": r["amount_usd"],
                        "date": r["date"],
                    }
                )
                w = LEAD_WEIGHT if role == "lead" else 1.0
                if g.has_edge(inv_id, r["company_id"]):
                    g[inv_id][r["company_id"]]["weight"] += w
                else:
                    g.add_edge(inv_id, r["company_id"], weight=w)
                per_round.setdefault(r["id"], set()).add(inv_id)

    betweenness = nx.betweenness_centrality(g, normalized=True) if g.number_of_nodes() > 2 else {}
    nodes = []
    for node in sorted(g.nodes):
        is_inv = node.startswith("inv_")
        record = (
            store.investors.get(node)
            if is_inv
            else store.companies.get(node) or store.competitors.get(node)
        )
        nodes.append(
            {
                "id": node,
                "kind": "investor" if is_inv else "company",
                "label": record["name"] if record else node,
                "is_competitor": (not is_inv) and node in store.competitors,
                "x": None,
                "y": None,
                "degree": int(g.degree(node)),
                "weighted_degree": round(float(g.degree(node, weight="weight")), 4),
                "betweenness": round(float(betweenness.get(node, 0.0)), 6),
            }
        )

    shared: dict[tuple[str, str], list[str]] = {}
    for rid, investors in per_round.items():
        for a, b in combinations(sorted(investors), 2):
            shared.setdefault((a, b), []).append(rid)
    coinvest = [
        {"source": a, "target": b, "weight": len(rids), "round_ids": sorted(rids)}
        for (a, b), rids in sorted(shared.items())
        if len(rids) >= MIN_SHARED_ROUNDS
    ]
    return {
        "version": version,
        "generated_at": generated_at,
        "layout": None,
        "nodes": nodes,
        "edges": edges,
        "coinvest_edges": coinvest,
    }
