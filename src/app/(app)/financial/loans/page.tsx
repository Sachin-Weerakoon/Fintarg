import { redirect } from "next/navigation";
import { Banknote, HandCoins, TrendingDown } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db";
import { currentMonthKey, formatDate, toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { loanMonthlyInterestCents, type LoanInput } from "@/lib/finance/analysis";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ReminderChip } from "@/components/financial/ReminderChip";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import {
  createLoanAction,
  deleteLoanAction,
  recordLoanRepaymentAction,
} from "../actions";

const METHOD_LABELS: Record<string, string> = {
  reducing: "Reducing balance",
  flat: "Flat rate",
  simple: "Simple interest",
  compound: "Compound monthly",
};

export default async function LoansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const csrf = await ensureCsrfToken();
  const month = currentMonthKey();
  const rows = await prisma.loan.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: [{ remainingBalanceCents: "desc" }, { createdAt: "desc" }],
  });

  const loans: LoanInput[] = rows.map((row) => ({
    id: row.id,
    lender: row.lender,
    principalCents: row.principalCents,
    interestRatePct: row.interestRatePct,
    method: row.method as LoanInput["method"],
    remainingBalanceCents: row.remainingBalanceCents,
    manualMonthlyInterestCents: row.manualMonthlyInterestCents,
    startDate: row.startDate,
    dueDate: row.dueDate,
  }));

  const interestById = new Map(loans.map((loan) => [loan.id, loanMonthlyInterestCents(loan, month)]));
  const interestTotal = loans.reduce((total, loan) => total + (interestById.get(loan.id) ?? 0), 0);
  const owedTotal = loans.reduce((total, loan) => total + loan.remainingBalanceCents, 0);
  const shortfallLoans = rows.filter((row) => row.sourceRef === "shortfall");

  const fields: FieldSpec[] = [
    { name: "lender", label: "Who gave you the loan?", type: "text", required: true, placeholder: "e.g. HNB Finance" },
    { name: "purpose", label: "What was it for?", type: "text", hint: "For example: vehicle" },
    { name: "principal", label: "How much was the original loan?", type: "amount", required: true, placeholder: "500000" },
    { name: "interestRatePct", label: "Interest rate a year", type: "number", min: "0", max: "100", step: "0.01", hint: "Annual rate, for example 18" },
    {
      name: "method",
      label: "How is the interest worked out?",
      type: "select",
      defaultValue: "reducing",
      options: [
{ value: "reducing", label: "Reducing balance" },
        { value: "flat", label: "Flat rate" },
        { value: "simple", label: "Simple interest" },
        { value: "compound", label: "Compound monthly" },
      ],
      hint: "Reducing balance is the normal bank method",
    },
    { name: "startDate", label: "Start date", type: "date", required: true, defaultValue: toDateInputValue(new Date()) },
    { name: "dueDate", label: "End date", type: "date", hint: "When the loan finishes" },
    { name: "remainingBalance", label: "What do you still owe today?", type: "amount", required: true, hint: "What you still owe today" },
    { name: "manualMonthlyInterest", label: "Interest each month", type: "amount", hint: "Leave empty to calculate it from the interest rate" },
  ];

  const repaymentFields: FieldSpec[] = [
    {
      name: "loanId",
      label: "Which loan?",
      type: "select",
      options: loans.map((loan) => ({ value: loan.id, label: loan.lender })),
    },
    { name: "repaymentAmount", label: "How much did you pay?", type: "amount", required: true, placeholder: "10000" },
  ];

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Loans"
        description="Money you borrowed. Each loan shows what you still owe and how much interest it costs you this month."
      />

      {shortfallLoans.length > 0 ? (
        <AlertBanner
          level="info"
          title="Some of these came from a month that fell short"
          message="When a month did not cover your bills, Fintarg offered to record the gap as a loan. Record a repayment below when you pay it off, so the balance and the monthly interest both come down."
        />
      ) : null}

      <Card>
        <CardHeader title="Add a loan" subtitle="Use the interest rate your lender gave you." />
        <RecordForm
          action={createLoanAction}
          fields={fields}
          submitLabel="Add loan"
          pendingLabel="Adding..."
          csrfToken={csrf}
          idPrefix="loan"
        />
      </Card>

      <Card>
        <p className="text-small font-medium text-text-muted">Total interest due this month</p>
        <p className="tabular mt-1 text-display font-semibold text-warning">{formatMoney(interestTotal)}</p>
        <p className="mt-1 text-small text-text-muted">
          You still owe {formatMoney(owedTotal)} in total. Interest comes out of what is left each month, so paying
          down a balance also brings this figure down.
        </p>
      </Card>

      <section aria-labelledby="loans-list-heading" className="flex flex-col gap-3">
        <h2 id="loans-list-heading" className="text-h2 font-medium text-text">
          Your loans
        </h2>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Banknote aria-hidden className="h-6 w-6" />}
            title="No loans yet"
            description="Add a loan to see how much interest it costs you each month. If a month falls short, Fintarg can record the gap as a loan for you."
          />
        ) : (
          <ul aria-label="Loans" className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id}>
                <Card as="div" className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-warning-soft text-warning">
                      <TrendingDown className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-text">
                        {row.lender}
                        {row.sourceRef === "shortfall" ? (
                          <Badge tone="warning" icon={<TrendingDown aria-hidden className="h-3 w-3" />}>
                            From a monthly shortfall
                          </Badge>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-small text-text-muted">
                        {METHOD_LABELS[row.method] ?? row.method} at {row.interestRatePct}% a year
                        {row.purpose ? ` · ${row.purpose}` : ""}
                      </p>
<p className="mt-1 text-small text-text-muted">
                        Started {formatDate(row.startDate)}
                        {row.dueDate ? ` · finishes ${formatDate(row.dueDate)}` : " · no end date yet"}
                      </p>
                      {row.dueDate ? (
                        <div className="mt-2">
                          <ReminderChip date={row.dueDate} prefix="Finish paying by" />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <div className="text-right">
                      <p className="tabular text-h2 font-semibold text-text">
                        {formatMoney(row.remainingBalanceCents)}
                      </p>
                      <p className="tabular text-caption text-text-muted">
                        {formatMoney(interestById.get(row.id) ?? 0)} interest this month
                      </p>
                    </div>
                    <ConfirmDelete
                      action={deleteLoanAction}
                      hiddenFields={{ id: row.id, _csrf: csrf }}
                      label="Delete"
                      title="Remove this loan?"
                      description="It stops counting towards your monthly interest. Your history keeps a record of it."
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {loans.length > 0 ? (
        <Card>
          <CardHeader
            title="Reduce remaining balance"
            subtitle="Use this after you make a payment. The amount you still owe goes down, and so does the interest next month."
          />
          <RecordForm
            action={recordLoanRepaymentAction}
            fields={repaymentFields}
            submitLabel="Record repayment"
            pendingLabel="Recording..."
            csrfToken={csrf}
            idPrefix="loan-repayment"
          />
          <p className="mt-3 flex items-start gap-2 text-caption text-text-muted">
            <HandCoins aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            Every repayment is written into your history with the date you recorded it.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
