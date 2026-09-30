import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonthKey, formatMonthLabel, type MonthKey } from "@/lib/dates";
import { buttonClass } from "@/components/ui/Button";

/** Month switcher built from plain links so it works without any client code. */
export function MonthNav({
  month,
  basePath,
  category,
}: {
  month: MonthKey;
  basePath: string;
  category?: string;
}) {
  const href = (key: MonthKey) => {
    const params = new URLSearchParams({ month: key });
    if (category) params.set("category", category);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <nav aria-label="Choose a month" className="flex items-center justify-between gap-2">
      <Link
        href={href(addMonthKey(month, -1))}
        className={buttonClass({ variant: "secondary", size: "sm" })}
        rel="prev"
      >
        <ChevronLeft aria-hidden className="h-4 w-4" />
        Previous month
      </Link>

      <p className="text-small font-medium text-text" aria-live="polite">
        {formatMonthLabel(month)}
      </p>

      <Link
        href={href(addMonthKey(month, 1))}
        className={buttonClass({ variant: "secondary", size: "sm" })}
        rel="next"
      >
        Next month
        <ChevronRight aria-hidden className="h-4 w-4" />
      </Link>
    </nav>
  );
}
