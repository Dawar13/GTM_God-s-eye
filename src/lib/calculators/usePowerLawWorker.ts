"use client";

import { useEffect, useState } from "react";
import type { PowerLawParams, PowerLawResponse } from "@/lib/workers/powerLawProtocol";
import type { PowerLawSeries } from "@/lib/viz/transforms/calcPowerLaw";

type Done =
  { key: string; ok: true; series: PowerLawSeries } | { key: string; ok: false; error: string };

const DEBOUNCE_MS = 150;

/**
 * Runs the Monte Carlo in a Web Worker. Every change of inputs ends the previous worker (the
 * simulation is one synchronous loop, so ending the worker is how a stale run is cancelled)
 * and starts a new one after a short pause, so dragging a slider never queues old runs. While
 * a run is going, `series` still holds the last finished one and `running` is true.
 */
export function usePowerLawWorker(params: PowerLawParams) {
  const key = JSON.stringify(params);
  const [done, setDone] = useState<Done | null>(null);
  const [last, setLast] = useState<PowerLawSeries | null>(null);

  useEffect(() => {
    let worker: Worker | null = null;
    const timer = setTimeout(() => {
      try {
        worker = new Worker(new URL("../workers/powerLaw.worker.ts", import.meta.url), {
          type: "module",
        });
      } catch {
        setDone({ key, ok: false, error: "This browser cannot start a background worker." });
        return;
      }
      worker.onmessage = (e: MessageEvent<PowerLawResponse>) => {
        const r = e.data;
        if (r.ok) {
          setDone({ key, ok: true, series: r.series });
          setLast(r.series);
        } else setDone({ key, ok: false, error: r.error });
        worker?.terminate();
        worker = null;
      };
      worker.onerror = () => {
        setDone({ key, ok: false, error: "The simulation worker failed." });
        worker?.terminate();
        worker = null;
      };
      worker.postMessage({ id: 1, params: JSON.parse(key) as PowerLawParams });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      worker?.terminate();
    };
  }, [key]);

  const current = done?.key === key ? done : null;
  return {
    series: current?.ok ? current.series : last,
    running: current === null,
    error: current && !current.ok ? current.error : null,
  };
}
