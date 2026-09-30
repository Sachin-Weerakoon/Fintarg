import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { currentMonthKey, formatDate, toDateInputValue } from "@/lib/dates";
import { loadAnalysis } from "@/lib/finance/load";
import { formatMoney, sum } from "@/lib/money";
import { can } from "@/lib/plans";
import { PageHeader } from "@/components/layout/PageHeader";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, SectionTitle } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { addContributionAction, deleteContributionAction } from "../actions";

export const metadata = { title: "Goal - Fintarg" };

function contributionFields(): FieldSpec[] {
  return [
    {
      name: "amount",
      label: "Amount saved",
      type: "amount",
      required: true,
      hint: "A daily amount or a lump sum - both work here",
    },
    {
      name: "date",
      label: "Date",
      type: "date",
      required: true,
      defaultValue: toDateInputValue(new Date()),
    },
    { name: "note", label: "Note", type: "text", hint: "Optional" },
  ];
}

export default async function GoalDetailPage({ params }: { params: Promise<{ goalId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.edition, "core.goals")) redirect("/");

  const { goalId } = await params;
  const goal = await prisma.savingsGoal.findFirst({
    where: { id: goalId, userId: user.id, deletedAt: null },
    include: { contributions: { orderBy: { date: "desc" } } },
  });
  if (!goal) notFound();

  const month = currentMonthKey();
  const [{ analysis }, csrfToken] = await Promise.all([loadAnalysis(user.id, month), ensureCsrfToken()]);

  const savedCents = sum(goal.contributions.map((contribution) => contribution.amountCents));
  const remaining = Math.max(0, goal.targetAmountCents - savedCents);
  const feasibility = analysis.goals.find((item) => item.goalId === goal.id);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={goal.name}
        description={
          goal.endDate
            ? `You would like to reach ${formatMoney(goal.targetAmountCents)} by ${formatDate(goal.endDate)}.`
            : `You would like to reach ${formatMoney(goal.targetAmountCents)}.`
        }
        action={
          <ButtonLink
            href="/goals"
            variant="secondary"
            size="sm"
            icon={<ArrowLeft aria-hidden className="h-4 w-4" />}
          >
            All goals
          </ButtonLink>
        }
      />

      <section aria-labelledby="goal-progress-heading" className="card p-card">
        <h2 id="goal-progress-heading" className="text-h2 font-medium text-text">
          Progress
        </h2>

        <p className="tabular mt-2 text-small text-text-muted">
          Saved so far {formatMoney(savedCents)} &middot; Remaining money{" "}
          {remaining === 0 ? formatMoney(0) : formatMoney(remaining)} to go
        </p>

        <div className="mt-3">
          <ProgressBar
            savedCents={savedCents}
            targetCents={goal.targetAmountCents}
            label={`${goal.name}: ${formatMoney(savedCents)} saved of ${formatMoney(goal.targetAmountCents)}`}
            tone={remaining === 0 ? "positive" : "accent"}
          />
        </div>

        <p className="tabular mt-2 text-small text-text-muted">
          Keep it up with {formatMoney(goal.dailyAmountCents)} a day &middot; {formatMoney(goal.monthlyTargetCents)}{" "}
          this month
        </p>

        {feasibility && feasibility.reason === "already_saved" ? (
          <AlertBanner level="success" title="Goal reached" message={feasibility.message} className="mt-4" />
        ) : null}

        {feasibility && !feasibility.achievable && feasibility.reason !== "already_saved" ? (
          <AlertBanner
            level="warning"
            title="Not possible this month"
            message={feasibility.message}
            className="mt-4"
          />
        ) : null}
      </section>

      <div id="add-savings">
        <Card>
          <CardHeader
            title="Add savings"
            subtitle="Log daily or lump-sum contributions. One form handles both - a lump sum is fine."
          />
          <RecordForm
            action={addContributionAction}
            fields={contributionFields()}
            submitLabel="Add savings"
            pendingLabel="Adding..."
            csrfToken={csrfToken}
            idPrefix="contribution"
            footer={<input type="hidden" name="goalId" value={goal.id} />}
          />
        </Card>
      </div>

      <section aria-labelledby="contributions-heading">
        <SectionTitle>Savings history</SectionTitle>

        {goal.contributions.length === 0 ? (
          <EmptyState
            compact
            title="Nothing added yet"
            description="Once you add your first saving it will appear here with the date and the amount."
            action={
              <ButtonLink href="#add-savings" variant="secondary" size="sm">
                Add the first one
              </ButtonLink>
            }
          />
        ) : (
          <ul className="card divide-y divide-border">
            {goal.contributions.map((contribution) => (
              <li key={contribution.id} className="flex flex-col gap-2 p-card sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="tabular text-body font-medium text-text">
                    <span className="sr-only">Saved amount: </span>
                    {formatMoney(contribution.amountCents)}
                  </p>
                  <p className="tabular text-caption text-text-muted">
                    {formatDate(contribution.date)}
                    {contribution.note ? ` · ${contribution.note}` : ""}
                  </p>
                </div>
                <ConfirmDelete
                  action={deleteContributionAction}
                  hiddenFields={{ id: contribution.id, _csrf: csrfToken }}
                  label="Remove"
                  title="Remove this saving?"
                  description="The amount is taken off your saved so far total."
                  className="self-start sm:self-auto"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
