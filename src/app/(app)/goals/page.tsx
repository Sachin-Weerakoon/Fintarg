import { redirect } from "next/navigation";
import { Target } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { can } from "@/lib/plans";
import { currentMonthKey, daysInMonth } from "@/lib/dates";
import { loadAnalysis } from "@/lib/finance/load";
import { formatMoney, sum } from "@/lib/money";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { GoalProgressCard } from "@/components/goals/GoalProgressCard";
import { createGoalAction, deleteGoalAction } from "./actions";

export const metadata = { title: "Savings goals - Fintarg" };

const CREATE_FIELDS: FieldSpec[] = [
  { name: "name", label: "What are you saving for?", type: "text", required: true, placeholder: "Emergency fund" },
  { name: "targetAmount", label: "Target amount", type: "amount", required: true, hint: "The full amount you want to reach" },
  {
    name: "mode",
    label: "You think about this goal by",
    type: "select",
    defaultValue: "daily",
    options: [
      { value: "daily", label: "Daily amount" },
      { value: "monthly", label: "Monthly amount" },
    ],
  },
  {
    name: "dailyAmount",
    label: "Daily amount",
    type: "amount",
    hint: "Leave empty - we will work it out from your target",
  },
  {
    name: "monthlyTarget",
    label: "Monthly amount",
    type: "amount",
    hint: "Leave empty - we will work it out from your target",
  },
  { name: "endDate", label: "End date", type: "date", hint: "When you would like to reach the target" },
  { name: "note", label: "Note", type: "textarea", rows: 2, hint: "Anything worth remembering about this goal" },
];

export default async function GoalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.edition, "core.goals")) redirect("/");

  const month = currentMonthKey();
  const [goals, { analysis }, csrfToken] = await Promise.all([
    prisma.savingsGoal.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { contributions: { orderBy: { date: "desc" } } },
      orderBy: { createdAt: "asc" },
    }),
    loadAnalysis(user.id, month),
    ensureCsrfToken(),
  ]);

  const totalSaved = sum(goals.map((goal) => sum(goal.contributions.map((c) => c.amountCents))));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Savings goals"
        description="Set a target, add what you save, and see whether this month can carry it."
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target aria-hidden className="h-6 w-6" />}
          title="No goals yet"
          description="A goal is a target you are saving towards, such as an emergency fund or a school fee. Add one below and Fintarg works out the daily and monthly amounts for you."
          action={
            <ButtonLink href="#add-goal" size="md">
              Add your first goal
            </ButtonLink>
          }
        />
      ) : null}

      {goals.length > 0 ? (
        <section aria-labelledby="goals-heading">
          <h2 id="goals-heading" className="sr-only">
            Your goals
          </h2>
          <ul className="flex flex-col gap-4">
            {goals.map((goal) => (
              <li key={goal.id}>
                <GoalProgressCard
                  goal={goal}
                  savedCents={sum(goal.contributions.map((c) => c.amountCents))}
                  feasibility={analysis.goals.find((item) => item.goalId === goal.id)}
                  csrfToken={csrfToken}
                  deleteAction={deleteGoalAction}
                />
              </li>
            ))}
          </ul>
          <p className="tabular mt-3 text-caption text-text-muted">
            Saved so far across {goals.length} {goals.length === 1 ? "goal" : "goals"}:{" "}
            {formatMoney(totalSaved)}
          </p>
        </section>
      ) : null}

      <div id="add-goal">
        <Card>
          <CardHeader
            title="Add a goal"
            subtitle="Give either a daily or a monthly amount - Fintarg works out the other one."
          />
          <RecordForm
            action={createGoalAction}
            fields={CREATE_FIELDS}
            submitLabel="Save goal"
            pendingLabel="Saving goal..."
            csrfToken={csrfToken}
            idPrefix="new-goal"
            footer={
              <p className="text-caption text-text-muted">
                Targets are checked against what is left after this month&apos;s bills ({daysInMonth(month)}{" "}
                days this month).
              </p>
            }
          />
        </Card>
      </div>
    </div>
  );
}
