import { formatMoneyCompact } from "@/lib/money";
import { cn } from "@/lib/cn";

export interface BarDatum {
  key: string;
  label: string;
  valueCents: number;
  /** Optional line under the label, e.g. a category share. */
  hint?: string;
}

/**
 * Horizontal bar list. Deliberately not a chart library: a bar list is
 * screen-reader friendly, prints cleanly and needs no client JavaScript.
 * Colour is never the only signal - each row carries its own value and share.
 */
export function BarList({
  data,
  tone = "accent",
  emptyLabel = "Nothing to show yet",
  className,
}: {
  data: BarDatum[];
  tone?: "accent" | "positive" | "warning" | "danger";
  emptyLabel?: string;
  className?: string;
}) {
  if (data.length === 0) {
    return <p className="text-small text-text-muted">{emptyLabel}</p>;
  }

  const max = Math.max(...data.map((datum) => Math.abs(datum.valueCents)), 1);
  const total = data.reduce((sum, datum) => sum + Math.abs(datum.valueCents), 0) || 1;
  const fill = {
    accent: "bg-accent",
    positive: "bg-positive",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {data.map((datum) => {
        const share = Math.round((Math.abs(datum.valueCents) / total) * 100);
        return (
          <li key={datum.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-small text-text">{datum.label}</span>
              <span className="tabular shrink-0 text-small font-medium text-text">
                {formatMoneyCompact(datum.valueCents)}
                <span className="ml-1 text-caption text-text-muted">{share}%</span>
              </span>
            </div>
            <div
              className="mt-1 h-2 w-full overflow-hidden rounded-pill bg-muted"
              role="img"
              aria-label={`${datum.label}: ${formatMoneyCompact(datum.valueCents)}, ${share} percent of the total`}
            >
              <div
                className={cn("h-full rounded-pill", fill)}
                style={{ width: `${Math.round((Math.abs(datum.valueCents) / max) * 100)}%` }}
              />
            </div>
            {datum.hint ? <p className="mt-0.5 text-caption text-text-muted">{datum.hint}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Compact day-by-day spend strip for the dashboard. */
export function DailySpendStrip({
  data,
  className,
}: {
  data: { date: Date; spentCents: number }[];
  className?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((day) => day.spentCents), 1);
  const total = data.reduce((sum, day) => sum + day.spentCents, 0);

  return (
    <div className={cn("w-full", className)}>
      <div
        className="flex h-24 items-end gap-[2px]"
        role="img"
        aria-label={`Daily spending for the month, ${formatMoneyCompact(total)} in total`}
      >
        {data.map((day) => (
          <div
            key={day.date.toISOString()}
            className="flex-1 rounded-t-[3px] bg-accent/70"
            style={{ height: `${Math.max(3, Math.round((day.spentCents / max) * 100))}%` }}
            title={`${day.date.getDate()}: ${formatMoneyCompact(day.spentCents)}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-caption text-text-muted">
        <span>1</span>
        <span>{data.length}</span>
      </div>
    </div>
  );
}
