/**
 * Precomputes the network layout (PHASE_1 §8): ForceAtlas2 in Node, from seeded
 * starting positions and a fixed number of iterations, so every run gives the
 * same picture and the app never lays out at runtime. Writes x/y into
 * data/processed/graph.json. Runs as part of `pnpm pipeline`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { mulberry32 } from "../src/lib/finance/power-law";
import { GraphDocument } from "../src/lib/schema/analytics";

const FILE = path.join(process.cwd(), "data", "processed", "graph.json");
const SEED = 42;
const ITERATIONS = 400;

async function main() {
  const doc = GraphDocument.parse(JSON.parse(await readFile(FILE, "utf8")));
  const g = new Graph({ type: "undirected", multi: false });
  const rand = mulberry32(SEED);
  for (const n of doc.nodes) g.addNode(n.id, { x: rand() * 100, y: rand() * 100 });
  for (const e of doc.edges) {
    if (g.hasEdge(e.source, e.target)) {
      g.updateEdgeAttribute(e.source, e.target, "weight", (w: number) => w + 1);
    } else {
      g.addEdge(e.source, e.target, { weight: 1 });
    }
  }
  if (g.order > 0) {
    forceAtlas2.assign(g, {
      iterations: ITERATIONS,
      settings: { ...forceAtlas2.inferSettings(g), barnesHutOptimize: false },
      getEdgeWeight: "weight",
    });
  }
  const round = (v: number) => Math.round(v * 1e4) / 1e4;
  const out = {
    ...doc,
    layout: { algorithm: "forceatlas2", iterations: ITERATIONS, seed: SEED },
    nodes: doc.nodes.map((n) => ({
      ...n,
      x: round(g.getNodeAttribute(n.id, "x") as number),
      y: round(g.getNodeAttribute(n.id, "y") as number),
    })),
  };
  await writeFile(FILE, JSON.stringify(out, null, 2) + "\n");
  console.log(`layout-graph: ${g.order} nodes, ${g.size} edges, ${ITERATIONS} iterations`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
