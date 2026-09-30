import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonthKey, currentMonthKey, formatMonthLabel, type MonthKey } from "@/lib/dates";

/** Month navigation used by the dashboard and the analysis screen. */
export function MonthSwitcher({
  month,
  basePath = "/analysis",
  label = "Month",
}: {
  month: MonthKey;
  basePath?: string;
  label?: string;
}) {
  const previous = addMonthKey(month, -1);
  const next = addMonthKey(month, 1);
  const isCurrent = month === currentMonthKey();

  return (
    <nav aria-label="Choose month" className="flex items-center gap-1 rounded-pill border border-border bg-surface p-1">
      <Link
        href={`${basePath}?month=${previous}`}
        className="flex h-9 w-9 items-center justify-center rounded-pill text-text transition-colors hover:bg-muted"
        aria-label={`Show ${formatMonthLabel(previous)}`}
      >
        <ChevronLeft aria-hidden className="h-5 w-5" />
      </Link>
      <span aria-live="polite" className="min-w-36 px-1 text-center text-small font-medium text-text">
        <span className="sr-only">{label}: </span>
        {formatMonthLabel(month)}
        {isCurrent ? <span className="ml-1 text-caption text-text-muted">(now)</span> : null}
      </span>
      <Link
        href={`${basePath}?month=${next}`}
        className="flex h-9 w-9 items-center justify-center rounded-pill text-text transition-colors hover:bg-muted"
        aria-label={`Show ${formatMonthLabel(next)}`}
      >
        <ChevronRight aria-hidden className="h-5 w-5" />
      </Link>
    </nav>
  );
}
