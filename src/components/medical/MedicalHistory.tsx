import { HeartPulse, Pill, Stethoscope } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { formatMoney, sum } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { deleteMedicalRecordAction } from "@/app/(app)/medical/actions";

export interface MedicalRecordItem {
  id: string;
  kind: string;
  date: Date;
  title: string;
  provider: string | null;
  amountCents: number | null;
  notes: string | null;
}

export interface MedicalMonthGroup {
  key: string;
  label: string;
  records: MedicalRecordItem[];
  totalCents: number;
}

const KIND_META: Record<string, { label: string; tone: BadgeTone; icon: React.ReactNode }> = {
  expense: { label: "Expense", tone: "accent", icon: <HeartPulse aria-hidden className="h-3.5 w-3.5" /> },
  appointment: {
    label: "Appointment",
    tone: "info",
    icon: <Stethoscope aria-hidden className="h-3.5 w-3.5" />,
  },
  medication: { label: "Medication", tone: "warning", icon: <Pill aria-hidden className="h-3.5 w-3.5" /> },
};

export function MedicalHistory({
  groups,
  csrfToken,
}: {
  groups: MedicalMonthGroup[];
  csrfToken: string;
}) {
  return (
    <Card>
      <CardHeader title="Your history" subtitle="Newest first. Deleting a record hides it only." />

      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`month-${group.key}`}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 id={`month-${group.key}`} className="text-small font-medium text-text">
                {group.label}
              </h3>
              <span className="tabular text-caption text-text-muted">
                {formatMoney(group.totalCents)} for medical
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {group.records.map((record) => {
                const meta = KIND_META[record.kind] ?? {
                  label: "Record",
                  tone: "neutral" as BadgeTone,
                  icon: null,
                };

                return (
                  <li
                    key={record.id}
                    className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={meta.tone} icon={meta.icon}>
                          {meta.label}
                        </Badge>
                        <span className="tabular text-caption text-text-muted">
                          {formatDate(record.date)}
                        </span>
                      </div>

                      <p className="mt-1.5 text-body font-medium text-text">{record.title}</p>

                      {record.provider ? (
                        <p className="text-small text-text-muted">{record.provider}</p>
                      ) : null}

                      {record.notes ? (
                        <p className="mt-1 whitespace-pre-line text-small text-text-muted">
                          {record.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
                      {record.amountCents != null ? (
                        <span className="tabular text-body font-medium text-text">
                          {formatMoney(record.amountCents)}
                        </span>
                      ) : null}
                      <ConfirmDelete
                        action={deleteMedicalRecordAction}
                        hiddenFields={{ id: record.id, _csrf: csrfToken }}
                        label="Delete"
                        title="Delete this medical record?"
                        description="It will be hidden from your history. This cannot be undone."
                        confirmLabel="Yes, delete"
                        variant="ghost"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Card>
  );
}

export function groupTotal(records: MedicalRecordItem[]): number {
  return sum(records.map((record) => record.amountCents ?? 0));
}
