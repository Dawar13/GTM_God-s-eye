import { cn } from "@/lib/utils";

export type ConfidenceLevel = "high" | "medium" | "low";

const LABEL: Record<ConfidenceLevel, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

/** Filled = high, half = medium, ring = low. Shape carries the level, not colour alone. */
export function ConfidenceDot({
  confidence,
  className,
}: {
  confidence: ConfidenceLevel | null | undefined;
  className?: string;
}) {
  const label = confidence ? LABEL[confidence] : "Confidence unknown";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-block size-2 shrink-0 rounded-full border border-accent",
        confidence === "high" && "bg-accent",
        confidence === "medium" && "bg-[linear-gradient(90deg,var(--accent)_50%,transparent_50%)]",
        className,
      )}
    />
  );
}

/** Source domain plus a confidence dot. The domain is text, not a link, so it can sit in tooltips. */
export function SourceBadge({
  domain,
  confidence,
  className,
}: {
  domain: string;
  confidence: ConfidenceLevel | null | undefined;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-2", className)}>
      <ConfidenceDot confidence={confidence} />
      <span>{domain}</span>
    </span>
  );
}
