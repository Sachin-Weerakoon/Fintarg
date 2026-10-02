import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarClock, Download, FileText, Target, TrendingDown, TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { loadAnalysis } from "@/lib/finance/load";
import { currentMonthKey, formatMonthLabel } from "@/lib/dates";
import { formatMoney, sum } from "@/lib/money";
import { GoalAffordabilityLine } from "@/components/goals/GoalAffordabilityLine";
import { MoneyTrendChart } from "@/components/charts/MoneyTrendChart";
import { loadMoneyTrend } from "@/lib/charts/load";
import { NetPositionCard, StatTile } from "@/components/NetPositionCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { BarList, DailySpendStrip } from "@/components/ui/BarList";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { MonthSwitcher } from "@/components/layout/MonthSwitcher";

export const metadata: Metadata = { title: "Monthly analysis" };
export const dynamic = "force-dynamic";

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

const params = await searchParams;
  const month = params.month ?? currentMonthKey();
  // The trend always ends on the month being viewed, so switching months moves the
  // whole window rather than showing a stale "last 6 months".
  const [{ analysis }, trend] = await Promise.all([
    loadAnalysis(user.id, month, { today: new Date() }),
    loadMoneyTrend(user.id, { months: 6, endMonth: month }),
  ]);
  const nextMonthLabel = formatMonthLabel(analysis.projection.month);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-h1 font-semibold text-text">Monthly analysis</h1>
          <p className="mt-1 text-small text-text-muted">
            {formatMonthLabel(analysis.month)} · every number here feeds the one at the top.
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <MonthSwitcher month={month} basePath="/analysis" />
<ButtonLink
            href={`/analysis/export?month=${month}`}
            variant="secondary"
            size="sm"
            icon={<Download aria-hidden className="h-4 w-4" />}
          >
            Analysis PDF
          </ButtonLink>
          <ButtonLink
            href={`/analysis/statement?month=${month}`}
            variant="secondary"
            size="sm"
            icon={<FileText aria-hidden className="h-4 w-4" />}
          >
            Statement PDF
          </ButtonLink>
        </div>
      </div>

      <NetPositionCard
        netPositionCents={analysis.netPositionCents}
        month={analysis.month}
        incomeCents={analysis.income.totalCents}
        outflowCents={analysis.outflow.totalCents}
        supportingLine={
          analysis.income.totalCents === 0
            ? "Add your income for this month to see a real number."
            : analysis.isShortfall
              ? `You are ${formatMoney(Math.abs(analysis.netPositionCents))} short. Turn it into a loan, or adjust spending.`
              : `${formatMoney(analysis.netPositionCents)} is left after everything you have planned.`
        }
        actionHref={analysis.isShortfall ? "/analysis/shortfall" : undefined}
        actionLabel={analysis.isShortfall ? "Record as loan" : undefined}
      />

      {analysis.warnings.map((warning) => (
        <AlertBanner
          key={warning.id}
          level={warning.level === "danger" ? "danger" : warning.level === "warning" ? "warning" : "info"}
          title={warning.title}
          message={warning.message}
          actionLabel={warning.actionLabel}
          actionHref={warning.actionHref}
        />
      ))}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total in"
          value={formatMoney(analysis.income.totalCents)}
          hint={`${formatMoney(analysis.income.recurringCents)} every month`}
          tone="positive"
          icon={<TrendingUp aria-hidden className="h-3.5 w-3.5" />}
        />
        <StatTile
          label="Total out"
          value={formatMoney(analysis.outflow.totalCents)}
          hint="Including savings you planned"
          icon={<TrendingDown aria-hidden className="h-3.5 w-3.5" />}
        />
        <StatTile
          label="Free cash"
          value={formatMoney(analysis.freeCashCents)}
          hint="What is left after bills, before saving"
          tone={analysis.freeCashCents < 0 ? "danger" : "accent"}
        />
        <StatTile
          label="Next month"
          value={formatMoney(analysis.projection.projectedNetCents)}
          hint={`Known bills: ${formatMoney(analysis.projection.obligationsTotalCents)}`}
          tone={analysis.projection.isShortfall ? "warning" : "positive"}
          icon={<CalendarClock aria-hidden className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Where your money goes"
            subtitle="Every part of this month's outflow, in plain words"
          />
          {analysis.outflow.totalCents === 0 ? (
            <EmptyState
              compact
              title="Nothing recorded yet"
              description="Add expenses, finance payments and savings goals and this breakdown fills in."
              action={<ButtonLink href="/financial/expenses" size="sm">Add an expense</ButtonLink>}
            />
          ) : (
            <BarList
              data={analysis.outflow.breakdown
                .filter((item) => item.amountCents > 0)
                .map((item) => ({ key: item.key, label: item.label, valueCents: item.amountCents, hint: item.detail }))}
              emptyLabel="No outflow yet"
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Where the money went" subtitle="Your spending by category this month" />
          {analysis.categoryTotals.length === 0 ? (
            <EmptyState compact title="No spending yet" description="Record a few expenses to see your spending mix." />
          ) : (
            <BarList
              data={analysis.categoryTotals.map((category) => ({
                key: category.category,
                label: category.category,
                valueCents: category.amountCents,
                hint: `${category.sharePct}% of your spending`,
              }))}
            />
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title={`Next month: ${nextMonthLabel}`}
          subtitle="Known obligations are already counted in, so this is a fair estimate"
        />
        {analysis.projection.obligations.length === 0 ? (
          <EmptyState
            compact
            title="No known bills next month"
            description="Add a finance payment or a pawned item and Fintarg will include it here automatically."
            action={<ButtonLink href="/financial/finance-payments" size="sm">Add a fixed payment</ButtonLink>}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {analysis.projection.obligations.map((obligation) => (
              <li
                key={obligation.key}
                className="flex min-h-touch items-center justify-between gap-3 rounded-input border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-small font-medium text-text">{obligation.label}</p>
                  <p className="truncate text-caption text-text-muted">
                    {obligation.dueDate
                      ? `Due ${obligation.dueDate.getDate()} ${obligation.dueDate.toLocaleString("en-GB", { month: "short" })}`
                      : (obligation.detail ?? "Due next month")}
                  </p>
                </div>
                <p className="tabular shrink-0 text-small font-medium text-text">
                  {formatMoney(obligation.amountCents)}
                </p>
              </li>
            ))}
            <li className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-small font-medium text-text">
                {analysis.projection.isShortfall ? "Expected shortfall" : "Expected remaining money"}
              </p>
              <p
                className={`tabular text-body font-semibold ${analysis.projection.isShortfall ? "text-danger" : "text-positive"}`}
              >
                {formatMoney(analysis.projection.projectedNetCents)}
              </p>
            </li>
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Can you still save this month?"
          subtitle="Checked against what is genuinely free after your bills"
          action={
            <Link href="/goals" className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline">
              Manage goals
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          }
        />
        {analysis.goals.length === 0 ? (
          <EmptyState
            compact
            title="No savings goals yet"
            description="Set a goal and Fintarg will tell you plainly whether this month can carry it."
            action={
              <ButtonLink href="/goals" size="sm" icon={<Target aria-hidden className="h-4 w-4" />}>
                Create a goal
              </ButtonLink>
            }
          />
        ) : (
          <>
            {/* D6: the whole-month figure the per-goal rows below cannot each show. */}
            <GoalAffordabilityLine
              incomeCents={analysis.income.totalCents}
              goalsRequiredCents={sum(analysis.goals.map((g) => g.requiredThisMonthCents))}
              goalCount={analysis.goals.length}
              heading="What saving for these goals would leave"
            />
            <ul className="mt-4 flex flex-col gap-4">
            {analysis.goals.map((goal) => (
              <li key={goal.goalId} className="rounded-card border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-small font-medium text-text">{goal.name}</p>
                  <Badge
                    tone={goal.reason === "already_saved" ? "positive" : goal.achievable ? "positive" : "warning"}
                    icon={
                      goal.achievable ? (
                        <TrendingUp aria-hidden className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown aria-hidden className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {goal.reason === "already_saved"
                      ? "Goal reached"
                      : goal.achievable
                        ? `Save ${formatMoney(Math.round(goal.requiredThisMonthCents / Math.max(1, goal.daysLeftInMonth)))} a day`
                        : "Not possible this month"}
                  </Badge>
                </div>
                <ProgressBar savedCents={goal.savedCents} targetCents={goal.targetCents} label={goal.name} />
                <p className="mt-2 text-caption text-text-muted">{goal.message}</p>
              </li>
            ))}
            </ul>
          </>
        )}
      </Card>

<Card>
        <CardHeader
          title="Six months at a glance"
          subtitle="Money in against money out. Anything below the break-even line is a month you came up short."
        />
        {trend.length > 0 ? (
          <MoneyTrendChart points={trend} />
        ) : (
          <EmptyState
            compact
            title="Not enough history yet"
            description="Record income and expenses for a month and it will appear here."
          />
        )}
      </Card>

      <Card>
        <CardHeader title="Spending day by day" subtitle="Your rhythm across the month" />
        {analysis.outflow.livingExpensesCents > 0 ? (
          <DailySpendStrip data={analysis.daily} />
        ) : (
          <EmptyState compact title="No spending recorded" description="Add your daily expenses to see this chart." />
        )}
      </Card>
    </div>
  );
}
