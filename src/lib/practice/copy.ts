import type { Challenge } from "@/lib/finance";
import { formatPercent, formatUsd } from "@/lib/format";

/** The question, in words. Money and percentages come from src/lib/format. */
export function challengePrompt(c: Challenge): string {
  switch (c.kind) {
    case "investor_post":
      return `A company raises ${formatUsd(c.investment)} at a ${formatUsd(c.preMoney)} pre-money valuation. What share of the company do the new investors own right after the round?`;
    case "founder_after":
      return `Founders own ${formatPercent(c.founderBefore)} of a company. It raises ${formatUsd(c.investment)} at a ${formatUsd(c.preMoney)} pre-money valuation. What do the founders own right after the round?`;
    case "two_rounds": {
      const [a, b] = c.rounds;
      return `Founders own ${formatPercent(c.founderBefore)} of a company. It raises ${formatUsd(a.investment)} at a ${formatUsd(a.preMoney)} pre-money valuation, then ${formatUsd(b.investment)} at a ${formatUsd(b.preMoney)} pre-money valuation. What do the founders own after both rounds?`;
    }
  }
}

/** The worked answer, one step per line, shown after a guess. */
export function challengeWorked(c: Challenge): string[] {
  switch (c.kind) {
    case "investor_post": {
      const post = c.preMoney + c.investment;
      return [
        `Post-money = pre-money + investment = ${formatUsd(c.preMoney)} + ${formatUsd(c.investment)} = ${formatUsd(post)}`,
        `New investors own investment ÷ post-money = ${formatUsd(c.investment)} ÷ ${formatUsd(post)} = ${formatPercent(c.answer)}`,
      ];
    }
    case "founder_after": {
      const post = c.preMoney + c.investment;
      const kept = c.preMoney / post;
      return [
        `Post-money = ${formatUsd(c.preMoney)} + ${formatUsd(c.investment)} = ${formatUsd(post)}`,
        `Existing holders keep pre-money ÷ post-money = ${formatUsd(c.preMoney)} ÷ ${formatUsd(post)} = ${formatPercent(kept)}`,
        `Founders own ${formatPercent(c.founderBefore)} × ${formatPercent(kept)} = ${formatPercent(c.answer)}`,
      ];
    }
    case "two_rounds": {
      const lines: string[] = [];
      c.rounds.forEach((r, i) => {
        const post = r.preMoney + r.investment;
        const kept = r.preMoney / post;
        lines.push(
          `Round ${i + 1}: post-money ${formatUsd(post)}; existing holders keep ${formatUsd(r.preMoney)} ÷ ${formatUsd(post)} = ${formatPercent(kept)}`,
        );
      });
      lines.push(
        `Founders own ${formatPercent(c.founderBefore)} × ${c.rounds.map((r) => formatPercent(r.preMoney / (r.preMoney + r.investment))).join(" × ")} = ${formatPercent(c.answer)}`,
      );
      return lines;
    }
  }
}
