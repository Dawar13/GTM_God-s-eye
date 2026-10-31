"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui-atlas";
import { parseNumberInput } from "@/lib/calculators/parse";
import { generateChallenge, scoreGuess } from "@/lib/finance";
import { formatCount, formatPercent } from "@/lib/format";
import { challengePrompt, challengeWorked } from "@/lib/practice/copy";
import { PRACTICE_KEYS, useStored } from "@/lib/practice/storage";
import { EMPTY_STREAK, isSeed, isStreakState, recordAnswer } from "@/lib/practice/streak";

const FIRST_SEED = 1;

/**
 * "Guess the ownership" prompts from the pricing engine, one seed per challenge. A guess within
 * one percentage point scores and extends the streak; the worked answer shows after every guess.
 */
export function ChallengeMode() {
  const [seed, setSeed] = useStored(PRACTICE_KEYS.seed, FIRST_SEED, isSeed);
  const [stats, setStats] = useStored(PRACTICE_KEYS.streak, EMPTY_STREAK, isStreakState);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const challenge = generateChallenge(seed);
  const answered = stats.last?.seed === seed ? stats.last : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (answered) return;
    const guess = parseNumberInput(text, "percent");
    if (guess === null || guess < 0 || guess > 1) {
      setError("Enter a percentage between 0 and 100, like 56 or 56%.");
      return;
    }
    setError(null);
    const { correct } = scoreGuess(guess, challenge.answer);
    setStats((s) => recordAnswer(s, { seed, guess, correct }));
  }

  function next() {
    setSeed(seed >= 4_294_967_295 ? FIRST_SEED : seed + 1);
    setText("");
    setError(null);
  }

  const result = answered ? scoreGuess(answered.guess, challenge.answer) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">
          Challenge <span className="num">{formatCount(seed)}</span>. Answer within 1 percentage
          point to score.
        </p>
        <p className="max-w-[60ch] text-lg leading-7">{challengePrompt(challenge)}</p>

        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="challenge-guess" className="text-sm font-medium">
              Your answer, in percent
            </label>
            <div className="relative">
              <input
                id="challenge-guess"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                disabled={answered !== null}
                value={answered ? String((answered.guess * 100).toFixed(1)) : text}
                onChange={(e) => setText(e.target.value)}
                aria-invalid={error !== null}
                aria-describedby={error ? "challenge-error" : undefined}
                className="h-8 w-36 rounded-md border border-rule bg-panel px-2.5 pr-7 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-70"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-ink-2">
                %
              </span>
            </div>
          </div>
          {answered ? (
            <Button type="button" onClick={next}>
              Next challenge
            </Button>
          ) : (
            <Button type="submit">Check answer</Button>
          )}
        </form>
        {error && (
          <p id="challenge-error" role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}

        {answered && result && (
          <div role="status" className="flex flex-col gap-3 rounded-lg bg-panel-sunk p-4">
            <p className="font-medium">
              {answered.correct
                ? `Scored. You were ${result.errorPoints.toFixed(1)} points away.`
                : `Not this time. You were ${result.errorPoints.toFixed(1)} points away.`}{" "}
              The answer is <span className="tabular-nums">{formatPercent(challenge.answer)}</span>.
            </p>
            <div>
              <p className="text-sm font-medium">Worked answer</p>
              <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5 text-sm text-ink-2 tabular-nums">
                {challengeWorked(challenge).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-rule p-4">
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Streak" value={formatCount(stats.streak)} />
          <Stat label="Best streak" value={formatCount(stats.best)} />
        </div>
        <p className="text-sm text-ink-2">
          <span className="num">{formatCount(stats.correct)}</span> scored out of{" "}
          <span className="num">{formatCount(stats.answered)}</span> answered. Kept in this browser
          only.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-ink-2"
          disabled={stats.answered === 0}
          onClick={() => setStats(EMPTY_STREAK)}
        >
          Reset streak and counts
        </Button>
      </div>
    </div>
  );
}
