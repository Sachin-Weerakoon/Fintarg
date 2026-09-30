import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatMoney, type Cents } from "@/lib/money";
import { formatMonthLabel, type MonthKey } from "@/lib/dates";

/**
 * Net-position card (UIX-001): large number + label + one supporting line, with
 * an amber/red border when the month is short. This is the single largest number
 * on the dashboard because it answers the main question first:
 * "Can I make it this month?"
 */
export function NetPositionCard({
  netPositionCents,
  month,
  supportingLine,
  incomeCents,
  outflowCents,
  actionHref,
  actionLabel,
  className,
}: {
  netPositionCents: Cents;
  month: MonthKey;
  supportingLine: string;
  incomeCents: Cents;
  outflowCents: Cents;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  const shortfall = netPositionCents < 0;
  const remaining = Math.abs(netPositionCents);

  return (
    <section
      aria-labelledby="net-position-heading"
      className={cn(
        "card relative overflow-hidden p-card",
        shortfall ? "border-2 border-danger bg-danger-soft/30" : "border-2 border-positive/50 bg-positive-soft/25",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="net-position-heading" className="flex items-center gap-2 text-h2 font-medium text-text">
            Net position this month
            <span className="sr-only">({formatMonthLabel(month)})</span>
          </h2>

          <p
            className={cn(
              "tabular mt-2 text-display font-semibold",
              shortfall ? "text-danger" : "text-positive",
            )}
          >
            {shortfall ? "Shortfall " : "Remaining "}
            {formatMoney(remaining)}
          </p>

          <p className="mt-2 flex items-start gap-2 text-small text-text-muted">
            {shortfall ? (
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            ) : (
              <TrendingUp aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
            )}
            <span>
              <span className="sr-only">{shortfall ? "Warning. " : ""}</span>
              {supportingLine}
            </span>
          </p>

          <p className="tabular mt-3 text-caption text-text-muted">
            Income {formatMoney(incomeCents)} · Outflow {formatMoney(outflowCents)}
          </p>
        </div>

        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className={cn(
              "inline-flex min-h-touch items-center justify-center gap-2 rounded-pill px-5 py-2.5 text-body font-medium transition-colors",
              shortfall
                ? "bg-danger text-white hover:brightness-110"
                : "bg-accent text-accent-contrast hover:brightness-110",
            )}
          >
            {shortfall ? <TrendingDown aria-hidden className="h-4 w-4" /> : null}
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/** Compact figure for the dashboard grid. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger" | "accent";
  href?: string;
}) {
  const toneClass = {
    neutral: "text-text",
    positive: "text-positive",
    warning: "text-warning",
    danger: "text-danger",
    accent: "text-accent",
  }[tone];

  const body = (
    <>
      <span className="flex items-center gap-2 text-caption font-medium uppercase tracking-wide text-text-muted">
        {icon}
        {label}
      </span>
      <span className={cn("tabular mt-1 block text-h1 font-semibold", toneClass)}>{value}</span>
      {hint ? <span className="mt-0.5 block text-caption text-text-muted">{hint}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="card p-card transition-colors hover:bg-muted focus-visible:outline-offset-4"
      >
        {body}
      </Link>
    );
  }
  return <div className="card p-card">{body}</div>;
}
