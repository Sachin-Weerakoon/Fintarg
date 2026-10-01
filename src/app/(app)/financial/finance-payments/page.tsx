import { redirect } from "next/navigation";
import { CalendarCheck2, CreditCard, Repeat } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db";
import { toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { paymentsRemainingFrom } from "@/lib/finance/analysis";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { ReminderChip } from "@/components/financial/ReminderChip";
import { createFinancePaymentAction, deleteFinancePaymentAction } from "../actions";

/**
 * B5: the count shown is what is genuinely still to pay *from today*, not the
 * figure originally entered. `monthsRemaining` is the whole term, so months
 * already elapsed since the start date are subtracted.
 */
function paymentsLeftText(row: {
  monthsRemaining: number | null;
  startDate: Date;
}): string {
  const left = paymentsRemainingFrom({
    id: "",
    lender: "",
    description: "",
    amountCents: 0,
    dueDayOfMonth: 1,
    monthsRemaining: row.monthsRemaining,
    startDate: row.startDate,
    active: true,
  });
  if (left == null) return " · keeps going";
  if (left === 0) return " · no payments left";
  return ` · ${left} payment${left === 1 ? "" : "s"} left`;
}

/** The next time a payment of `dueDayOfMonth` falls due, counting today. */
function nextDueDate(dayOfMonth: number, from: Date): Date {
  const midnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const thisMonthLast = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  const thisMonth = new Date(from.getFullYear(), from.getMonth(), Math.min(dayOfMonth, thisMonthLast));
  if (thisMonth >= midnight) return thisMonth;
  const nextMonthLast = new Date(from.getFullYear(), from.getMonth() + 2, 0).getDate();
  return new Date(from.getFullYear(), from.getMonth() + 1, Math.min(dayOfMonth, nextMonthLast));
}

export default async function FinancePaymentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const csrf = await ensureCsrfToken();
  const rows = await prisma.financePayment.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: [{ active: "desc" }, { dueDayOfMonth: "asc" }],
  });

  const activeRows = rows.filter((row) => row.active);
  const monthlyTotal = activeRows.reduce((total, row) => total + row.amountCents, 0);
  const today = new Date();

  const fields: FieldSpec[] = [
    { name: "lender", label: "Who do you pay?", type: "text", required: true, placeholder: "e.g. Commercial Bank" },
    { name: "description", label: "What is this payment for?", type: "text", required: true, placeholder: "e.g. Lease" },
    { name: "amount", label: "How much each month?", type: "amount", required: true, placeholder: "25000" },
    { name: "dueDayOfMonth", label: "Day of the month it is due", type: "number", required: true, min: "1", max: "31", hint: "For example 15 for the 15th" },
    { name: "monthsRemaining", label: "Months left", type: "number", min: "0", max: "600", hint: "Leave empty if it never ends" },
    { name: "startDate", label: "Start date", type: "date", defaultValue: toDateInputValue(today) },
    { name: "active", label: "Still paying this", type: "checkbox", checked: true },
  ];

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Finance payments"
        description="Bills you pay every month on a fixed day, such as a lease or a hire purchase."
      />

      <Card>
        <CardHeader title="Add a monthly payment" subtitle="One entry per bill you pay every month." />
        <RecordForm
          action={createFinancePaymentAction}
          fields={fields}
          submitLabel="Add payment"
          pendingLabel="Adding..."
          csrfToken={csrf}
          idPrefix="finance-payment"
        />
      </Card>

      <Card tone={activeRows.length ? "accent" : "default"}>
        <p className="text-small font-medium text-text-muted">Total every month</p>
        <p className="tabular mt-1 text-display font-semibold text-text">{formatMoney(monthlyTotal)}</p>
        <p className="mt-1 text-small text-text-muted">
          {activeRows.length
            ? `${activeRows.length} active payment(s) come out of every month you earn.`
            : "Nothing is being paid every month yet."}
        </p>
      </Card>

      <section aria-labelledby="finance-list-heading" className="flex flex-col gap-3">
        <h2 id="finance-list-heading" className="text-h2 font-medium text-text">
          Your monthly payments
        </h2>

        {rows.length === 0 ? (
          <EmptyState
            icon={<CreditCard aria-hidden className="h-6 w-6" />}
            title="No finance payments yet"
            description="Add a lease, loan instalment or any other bill you pay on the same day every month. Your monthly total appears above."
          />
        ) : (
          <ul aria-label="Finance payments" className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id}>
                <Card as="div" className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-accent">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-text">
                        {row.lender}
                        <Badge tone={row.active ? "positive" : "neutral"} icon={row.active ? <Repeat aria-hidden className="h-3 w-3" /> : undefined}>
                          {row.active ? "Active" : "Finished"}
                        </Badge>
                      </p>
                      <p className="mt-0.5 text-small text-text-muted">{row.description}</p>
                      <p className="mt-1 text-small text-text-muted">
                        Due on day {row.dueDayOfMonth} of every month
                        {paymentsLeftText(row)}
                      </p>
                      {row.active ? (
                        <p className="mt-2">
                          <ReminderChip
                            date={nextDueDate(row.dueDayOfMonth, today)}
                            prefix="Next payment"
                          />
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <p className="tabular text-h2 font-semibold text-text">{formatMoney(row.amountCents)}</p>
                    <ConfirmDelete
                      action={deleteFinancePaymentAction}
                      hiddenFields={{ id: row.id, _csrf: csrf }}
                      label="Delete"
                      title="Remove this payment?"
                      description="It stops counting towards your monthly total. Your history keeps a record of it."
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-start gap-2 text-caption text-text-muted">
          <CalendarCheck2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          Reminders are worked out from the due day you entered, so you do not need to set them one by one.
        </p>
      </section>
    </div>
  );
}
