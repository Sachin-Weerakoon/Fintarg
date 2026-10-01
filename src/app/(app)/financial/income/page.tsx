import { redirect } from "next/navigation";
import { Banknote, Inbox, RefreshCw } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db";
import { currentMonthKey, formatDate, toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { incomeForMonth, type IncomeInput } from "@/lib/finance/analysis";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { createIncomeAction, deleteIncomeAction } from "../actions";

const KIND_LABELS: Record<string, { label: string; tone: BadgeTone }> = {
  salary: { label: "Salary", tone: "positive" },
  business: { label: "Business", tone: "accent" },
  other: { label: "Other", tone: "neutral" },
};

function frequencyText(frequency: string, customIntervalDays: number | null): string {
  if (frequency === "one_time") return "One-time";
  if (frequency === "custom") return customIntervalDays ? `Every ${customIntervalDays} days` : "Custom";
  return "Every month";
}

export default async function IncomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const csrf = await ensureCsrfToken();
  const month = currentMonthKey();

  const rows = await prisma.income.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const monthIncomes: IncomeInput[] = rows.map((row) => ({
    id: row.id,
    sourceName: row.sourceName,
    kind: row.kind as IncomeInput["kind"],
    amountCents: row.amountCents,
    frequency: row.frequency as IncomeInput["frequency"],
    date: row.date,
    recurring: row.recurring,
    customIntervalDays: row.customIntervalDays,
  }));
  const thisMonth = incomeForMonth(monthIncomes, month);
  const thisMonthTotal = thisMonth.reduce((total, income) => total + income.amountCents, 0);

  const fields: FieldSpec[] = [
    { name: "sourceName", label: "Where does this money come from?", type: "text", required: true, placeholder: "e.g. Salary" },
    {
      name: "kind",
      label: "What kind of income is this?",
      type: "select",
      defaultValue: "salary",
      options: [
        { value: "salary", label: "Salary" },
        { value: "business", label: "Business" },
        { value: "other", label: "Other" },
      ],
    },
    { name: "amount", label: "How much?", type: "amount", required: true, placeholder: "50000" },
    {
      name: "frequency",
      label: "How often does it arrive?",
      type: "select",
      defaultValue: "monthly",
      options: [
        { value: "monthly", label: "Every month" },
        { value: "one_time", label: "One-time" },
        { value: "custom", label: "Custom" },
      ],
    },
    { name: "customIntervalDays", label: "Days between each time", type: "number", min: "1", max: "365", hint: "Leave empty unless you picked Custom" },
    { name: "date", label: "Date", type: "date", required: true, defaultValue: toDateInputValue(new Date()) },
    {
      name: "recurring",
      label: "Repeat every month",
      type: "checkbox",
      // B6: salary is the default kind, and a salary arrives every month, so the
      // box starts ticked. The engine also treats a "monthly" frequency as
      // recurring regardless of this flag, so an unticked salary still counts.
      checked: true,
      hint: "Include this in next month's projection",
    },
    { name: "notes", label: "Notes", type: "text", hint: "Anything you want to remember" },
  ];

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Income"
        description="Every rupee that comes in. This month your recorded income is shown at the top."
      />

      <Card>
        <CardHeader title="Add income" subtitle="One source per entry. You can add more at any time." />
        <RecordForm
          action={createIncomeAction}
          fields={fields}
          submitLabel="Add income"
          pendingLabel="Adding..."
          csrfToken={csrf}
          idPrefix="income"
        />
        <p className="mt-3 text-caption text-text-muted">
          Changing an entry is not available yet in this version. Remove it with Delete and add it again.
        </p>
      </Card>

      <section aria-labelledby="income-total-heading" className="flex flex-col gap-4">
        <Card>
          <h2 id="income-total-heading" className="text-small font-medium text-text-muted">
            Expected this month
          </h2>
          <p className="tabular mt-1 text-display font-semibold text-positive">
            {formatMoney(thisMonthTotal)}
          </p>
          <p className="mt-1 text-caption text-text-muted">
            {thisMonth.length} source(s) counted for this month.
          </p>
        </Card>

        <div>
          <h2 className="mb-3 text-h2 font-medium text-text">All income sources</h2>
          {rows.length === 0 ? (
            <EmptyState
              icon={<Inbox aria-hidden className="h-6 w-6" />}
              title="No income yet"
              description="Add your salary or any other money that comes in using the form above. Then your monthly totals start working."
            />
          ) : (
            <ul aria-label="Income sources" className="flex flex-col gap-3">
              {rows.map((row) => {
                const kind = KIND_LABELS[row.kind] ?? KIND_LABELS.other;
                return (
                  <li key={row.id}>
                    <Card as="div" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent">
                          <Banknote className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-medium text-text">
                            {row.sourceName}
                            <Badge tone={kind.tone}>{kind.label}</Badge>
                            {row.recurring ? (
                              <Badge tone="info" icon={<RefreshCw aria-hidden className="h-3 w-3" />}>
                                Repeats
                              </Badge>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-caption text-text-muted">
                            {frequencyText(row.frequency, row.customIntervalDays)} · {formatDate(row.date)}
                            {row.notes ? ` · ${row.notes}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <p className="tabular text-h2 font-semibold text-text">{formatMoney(row.amountCents)}</p>
                        <ConfirmDelete
                          action={deleteIncomeAction}
                          hiddenFields={{ id: row.id, _csrf: csrf }}
                          label="Delete"
                          title="Remove this income source?"
                          description={`${row.sourceName} will stop counting towards your monthly totals. It is kept in your history.`}
                        />
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
