import { formatMoney, type Cents } from "@/lib/money";

/**
 * Share of a whole: used for category splits, where the wording is "this share
 * of the month" rather than "saved so far". The percentage is always next to
 * the amounts, never on its own.
 */
export function ShareBar({
  label,
  amountCents,
  sharePct,
  totalCents,
  tone = "accent",
}: {
  label: string;
  amountCents: Cents;
  sharePct: number;
  totalCents: Cents;
  tone?: "accent" | "positive" | "warning" | "danger";
}) {
  const filled = Math.min(100, Math.max(0, sharePct));
  const fill = {
    accent: "bg-accent",
    positive: "bg-positive",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-small font-medium text-text">{label}</span>
        <span className="tabular text-small font-medium text-text">{formatMoney(amountCents)}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={sharePct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${sharePct}% of this month's spending`}
        className="h-2.5 w-full overflow-hidden rounded-pill bg-muted"
      >
        <div className={`h-full rounded-pill transition-[width] duration-250 ${fill}`} style={{ width: `${filled}%` }} />
      </div>
      <p className="tabular text-caption text-text-muted">
        {sharePct}% of {formatMoney(totalCents)} spent this month
      </p>
    </li>
  );
}
