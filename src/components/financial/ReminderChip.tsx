import { CalendarClock } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { daysUntil, formatDate, relativeDayLabel } from "@/lib/dates";

/**
 * Reminder chip: the date plus a plain "in 3 days" phrase. The tone is only a
 * second signal - the words always carry the meaning on their own.
 */
export function ReminderChip({
  date,
  prefix,
}: {
  date: Date;
  prefix: string;
}) {
  const days = daysUntil(date);
  const tone: BadgeTone = days <= 7 ? "danger" : days <= 30 ? "warning" : "positive";

  return (
    <Badge tone={tone} icon={<CalendarClock aria-hidden className="h-3.5 w-3.5" />}>
      {prefix} {formatDate(date)} · {relativeDayLabel(date)}
    </Badge>
  );
}
