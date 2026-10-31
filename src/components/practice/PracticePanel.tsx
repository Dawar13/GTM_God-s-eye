"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChallengeMode } from "@/components/practice/ChallengeMode";
import { ScenarioMode } from "@/components/practice/ScenarioMode";
import { Panel, Segmented } from "@/components/ui-atlas";
import { PRACTICE_KEYS, useStored } from "@/lib/practice/storage";
import { isFlag } from "@/lib/practice/streak";

type Mode = "scenario" | "challenge";

/**
 * Practice mode, above the calculator when switched on: build a three-round path to an exit,
 * or guess an ownership figure and see it worked. A link that carries a scenario switches
 * Practice on, so a shared scenario opens as it was sent.
 */
export function PracticePanel() {
  const [on, setOn] = useStored(PRACTICE_KEYS.on, false, isFlag);
  const [mode, setMode] = useState<Mode>("scenario");
  const hasScenario = useSearchParams().has("prr");

  useEffect(() => {
    if (hasScenario && !on) setOn(true);
  }, [hasScenario, on, setOn]);

  if (!on) return null;
  return (
    <Panel id="practice-panel" aria-label="Practice" className="mb-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Practice</h2>
          <p className="text-sm text-ink-2">
            Optional exercises with made-up numbers. Nothing here is data about a real company.
          </p>
        </div>
        <Segmented<Mode>
          label="Practice mode"
          options={[
            { value: "scenario", label: "Scenario" },
            { value: "challenge", label: "Challenge" },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
      {mode === "scenario" ? <ScenarioMode /> : <ChallengeMode />}
    </Panel>
  );
}
