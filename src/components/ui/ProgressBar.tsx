import { cn } from "@/lib/cn";
import { formatMoney, percent, type Cents } from "@/lib/money";

/**
 * Progress bar: saved / target / percentage shown together (UIX-001: "Progress is
 * never shown as percentage alone"). `format="split"` draws saved and remaining
 * in two distinguishable tones with a text legend underneath.
 */
export function ProgressBar({
  savedCents,
  targetCents,
  label,
  tone = "accent",
  showAmounts = true,
  className,
  compact = false,
}: {
  savedCents: Cents;
  targetCents: Cents;
  label?: string;
  tone?: "accent" | "positive" | "warning" | "danger";
  showAmounts?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const ratio = percent(savedCents, targetCents);
  const filled = Math.min(100, Math.max(0, ratio));
  const remaining = Math.max(0, targetCents - savedCents);
  const over = savedCents > targetCents && targetCents > 0;

  const fill = {
    accent: "bg-accent",
    positive: "bg-positive",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];

  const toneText = {
    accent: "text-text",
    positive: "text-positive",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];

  return (
    <div className={cn("w-full", className)}>
      {showAmounts ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className={cn("tabular text-small font-medium", toneText)}>{formatMoney(savedCents)}</span>
          <span className="tabular text-small text-text-muted">
            of {formatMoney(targetCents)}
            {!over && targetCents > 0 ? ` · ${formatMoney(remaining)} to go` : ""}
          </span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={ratio}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ? `${label}: ${ratio}% saved` : `${ratio}% saved`}
        className={cn(
          "relative w-full overflow-hidden rounded-pill bg-muted",
          compact ? "h-1.5" : "h-2.5",
        )}
      >
        <div
          className={cn("h-full rounded-pill transition-[width] duration-250", fill)}
          style={{ width: `${filled}%` }}
        />
      </div>
      <p className="mt-1.5 text-caption text-text-muted">
        {ratio}% of your target saved
        {over ? " · target reached" : ""}
      </p>
    </div>
  );
}
