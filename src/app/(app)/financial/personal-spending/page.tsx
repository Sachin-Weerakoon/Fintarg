import { redirect } from "next/navigation";
import { Sparkles, Target } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db";
import { currentMonthKey, formatMonthLabel, formatDate, monthRange } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { loadAnalysis } from "@/lib/finance/load";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { deleteExpenseAction, savePersonalPlanAction } from "../actions";

const PLAN_WARNINGS = new Set(["personal-near", "personal-over"]);

export default async function PersonalSpendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const csrf = await ensureCsrfToken();
  const month = currentMonthKey();
  const { start, end } = monthRange(month);

  const [{ analysis, raw }, personalRows] = await Promise.all([
    loadAnalysis(user.id, month),
    prisma.expense.findMany({
      where: { userId: user.id, deletedAt: null, isPersonal: true, date: { gte: start, lte: end } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const plannedCents = raw.plannedPersonalCents;
  const spentCents = analysis.actualPersonalSpendingCents;
  const remainingCents = analysis.personalPlanRemainingCents;
  const overBy = Math.max(0, -remainingCents);

  const usageLine = plannedCents
    ? `${formatMoney(spentCents)} of ${formatMoney(plannedCents)} · ${analysis.personalPlanUsagePct}% used · ${
        overBy > 0 ? `${formatMoney(overBy)} over` : `${formatMoney(remainingCents)} left`
      }`
    : "You have not set a plan for this month yet.";

  const fields: FieldSpec[] = [
    { name: "month", label: "Month", type: "month", required: true, defaultValue: month },
    {
      name: "plannedAmount",
      label: "How much do you plan to enjoy?",
      type: "amount",
      required: true,
      placeholder: "5000",
      hint: "How much you plan to enjoy this month, e.g. 5000",
    },
  ];

  const planWarnings = analysis.warnings.filter((warning) => PLAN_WARNINGS.has(warning.id));

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Personal spending plan"
        description="Money set aside for yourself, separate from bills and food. Saving the plan is the point; the progress bar shows how much of it you have used."
      />

      {planWarnings.map((warning) => (
        <AlertBanner
          key={warning.id}
          level={warning.id === "personal-over" ? "danger" : "warning"}
          title={warning.title}
          message={warning.message}
        />
      ))}

      <Card>
        <CardHeader
          title={`Your plan for ${formatMonthLabel(month)}`}
          subtitle="Change the number any time. It affects this month and the next month forecast."
        />
        <RecordForm
          action={savePersonalPlanAction}
          fields={fields}
          submitLabel="Save plan"
          pendingLabel="Saving..."
          csrfToken={csrf}
          idPrefix="personal-plan"
        />
      </Card>

      <Card
        tone={
          analysis.personalPlanStatus === "over"
            ? "danger"
            : analysis.personalPlanStatus === "near_limit"
              ? "warning"
              : "accent"
        }
      >
        <h2 className="text-small font-medium text-text-muted">
          {formatMonthLabel(month)} so far
        </h2>
        {plannedCents > 0 ? (
          <>
            <ProgressBar
              savedCents={spentCents}
              targetCents={plannedCents}
              label={`Personal spending for ${formatMonthLabel(month)}`}
              tone={
                analysis.personalPlanStatus === "over"
                  ? "danger"
                  : analysis.personalPlanStatus === "near_limit"
                    ? "warning"
                    : "positive"
              }
            />
            <p className="tabular mt-3 text-small font-medium text-text">{usageLine}</p>
          </>
        ) : (
          <>
            <p className="tabular mt-1 text-display font-semibold text-text">{formatMoney(spentCents)}</p>
            <p className="mt-1 text-small text-text-muted">{usageLine}</p>
          </>
        )}

        <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-small text-text-muted">
          <Target aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          {plannedCents > 0
            ? `This plan is included in next month's projection at ${formatMoney(plannedCents)}.`
            : "Set a plan above and it will be included in next month's projection."}
        </p>
      </Card>

      <section aria-labelledby="personal-list-heading" className="flex flex-col gap-3">
        <h2 id="personal-list-heading" className="text-h2 font-medium text-text">
          Spending for yourself
        </h2>

        {personalRows.length === 0 ? (
          <EmptyState
            icon={<Sparkles aria-hidden className="h-6 w-6" />}
            title="Nothing counted against your plan yet"
            description="When you record an expense, tick “This was for me” on the Expenses screen. It will then show up here and count towards your plan."
          />
        ) : (
          <ul aria-label="Personal expenses this month" className="flex flex-col gap-3">
            {personalRows.map((row) => (
              <li key={row.id}>
                <Card as="div" className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-small font-medium text-text">{row.categoryName}</p>
                    <p className="text-caption text-text-muted">
                      {row.note ?? "No note"} · {formatDate(row.date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular text-small font-semibold text-text">
                      {formatMoney(row.amountCents)}
                    </span>
                    <ConfirmDelete
                      action={deleteExpenseAction}
                      hiddenFields={{ id: row.id, _csrf: csrf }}
                      label="Delete"
                      title="Remove this personal expense?"
                      description="It stops counting towards your plan. Your history keeps a record of it."
                      variant="ghost"
                    />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <p className="tabular text-small text-text-muted">
          {formatMoney(spentCents)} counted this month across {personalRows.length} entry/entries.
        </p>
      </section>
    </div>
  );
}
