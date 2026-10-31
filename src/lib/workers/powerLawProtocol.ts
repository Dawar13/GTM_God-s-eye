import { simulatePortfolio } from "@/lib/finance/power-law";
import { powerLawSeries, type PowerLawSeries } from "@/lib/viz/transforms/calcPowerLaw";

/**
 * The messages between the power-law page and its Web Worker. The worker only calls
 * `handlePowerLawRequest`, which calls the pure finance function, so tests run exactly what
 * the browser runs: the same seed gives the same series either way.
 */
export type PowerLawParams = {
  /** Companies in the portfolio. */
  n: number;
  /** Pareto shape; lower is a fatter tail. */
  alpha: number;
  /** Minimum multiple for a company that does not fail. */
  xm: number;
  /** Share of companies that return nothing. */
  lossRate: number;
  trials: number;
  seed: number;
};

export type PowerLawRequest = { id: number; params: PowerLawParams };

export type PowerLawResponse =
  { id: number; ok: true; series: PowerLawSeries } | { id: number; ok: false; error: string };

export function runPowerLaw(p: PowerLawParams): PowerLawSeries {
  const sim = simulatePortfolio({
    n: p.n,
    trials: p.trials,
    seed: p.seed,
    distribution: { kind: "pareto", alpha: p.alpha, xm: p.xm, lossRate: p.lossRate },
  });
  return powerLawSeries(sim);
}

export function handlePowerLawRequest(req: PowerLawRequest): PowerLawResponse {
  try {
    return { id: req.id, ok: true, series: runPowerLaw(req.params) };
  } catch (e) {
    return {
      id: req.id,
      ok: false,
      error: e instanceof Error ? e.message : "The simulation could not run.",
    };
  }
}
