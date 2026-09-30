import { CalendarCheck, Clock, TriangleAlert } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { daysUntil, formatDate, relativeDayLabel } from "@/lib/dates";
import { completeMedicalReminderAction } from "@/app/(app)/medical/actions";

export interface UpcomingReminder {
  id: string;
  title: string;
  dueDate: Date;
}

/** Urgency is carried by the wording and the icon, never by colour alone. */
function urgencyTone(days: number): { tone: BadgeTone; icon: React.ReactNode } {
  if (days <= 3) {
    return { tone: "danger", icon: <TriangleAlert aria-hidden className="h-3.5 w-3.5" /> };
  }
  if (days <= 14) {
    return { tone: "warning", icon: <Clock aria-hidden className="h-3.5 w-3.5" /> };
  }
  return { tone: "positive", icon: <CalendarCheck aria-hidden className="h-3.5 w-3.5" /> };
}

export function MedicalReminders({
  reminders,
  csrfToken,
}: {
  reminders: UpcomingReminder[];
  csrfToken: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Coming up"
        subtitle="Doses and appointments you asked us to remind you about."
      />

      {reminders.length === 0 ? (
        <p className="text-small text-text-muted">
          Nothing scheduled. Add a next dose or appointment date when you save a record and it
          will show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reminders.map((reminder) => {
            const days = daysUntil(reminder.dueDate);
            const { tone, icon } = urgencyTone(days);
            const relative = relativeDayLabel(reminder.dueDate);

            return (
              <li
                key={reminder.id}
                className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-text">{reminder.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-small text-text-muted">
                    <span className="tabular">{formatDate(reminder.dueDate)}</span>
                    <Badge tone={tone} icon={icon}>
                      {relative}
                    </Badge>
                  </p>
                </div>

                <form action={completeMedicalReminderAction} className="shrink-0">
                  <input type="hidden" name="id" value={reminder.id} />
                  <input type="hidden" name="_csrf" value={csrfToken} />
                  <button
                    type="submit"
                    className={buttonClass({ variant: "secondary", size: "sm" })}
                    aria-label={`Mark ${reminder.title} as done`}
                  >
                    <CalendarCheck aria-hidden className="h-4 w-4" />
                    Mark as done
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
