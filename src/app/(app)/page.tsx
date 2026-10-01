import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  HeartPulse,
  Plus,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadAnalysis } from "@/lib/finance/load";
import { currentMonthKey, formatDate, relativeDayLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/plans";
import { collectUpcoming, type UpcomingItem } from "@/lib/reminders";
import { NetPositionCard, StatTile } from "@/components/NetPositionCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DailySpendStrip } from "@/components/ui/BarList";
import { MonthSwitcher } from "@/components/layout/MonthSwitcher";

export const metadata: Metadata = { title: "Home" };

export const dynamic = "force-dynamic";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const month = params.month ?? currentMonthKey();
  const today = new Date();

  const [{ analysis, raw }, reminderRows, agreements] = await Promise.all([
    loadAnalysis(user.id, month, { today }),
    prisma.reminder.findMany({
      where: {
        userId: user.id,
        status: "pending",
        dueDate: { gte: new Date(today.getTime() - 86_400_000) },
        kind: "medical",
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    can(user.edition, "business.advanced")
      ? prisma.agreement.findMany({
          where: { userId: user.id, deletedAt: null, endDate: { not: null } },
          orderBy: { endDate: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  const upcoming = collectUpcoming(
    {
      financePayments: raw.financePayments,
      pawnedItems: raw.pawnedItems,
      loans: raw.loans,
      goals: raw.goals.map((goal) => ({
        id: goal.id,
        name: goal.name,
        remainingCents: Math.max(0, goal.targetAmountCents - goal.savedCents),
        endDate: goal.endDate ?? null,
      })),
      medicalReminders: reminderRows.map((row) => ({ id: row.id, title: row.title, dueDate: row.dueDate })),
      agreements: agreements.map((row) => ({
        id: row.id,
        title: row.title,
        otherParty: row.otherParty,
        endDate: row.endDate,
        status: row.status,
      })),
    },
    { today, month },
  );

  const firstName = (user.fullName ?? user.displayName).split(" ")[0];
  const isEmpty = raw.incomes.length === 0 && raw.expenses.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-h1 font-semibold text-text">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-small text-text-muted">
            Here is where you stand for {formatDate(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1), "MMMM yyyy")}.
          </p>
        </div>
        <div className="no-print">
          <MonthSwitcher month={month} basePath="/" />
        </div>
      </div>

      {isEmpty ? (
        <AlertBanner
          level="info"
          title="Start with your income"
          message="Add your salary first, then your regular payments. Fintarg does the rest."
          actionLabel="Add income"
          actionHref="/financial/income"
        />
      ) : null}

      <NetPositionCard
        netPositionCents={analysis.netPositionCents}
        month={analysis.month}
        incomeCents={analysis.income.totalCents}
        outflowCents={analysis.outflow.totalCents}
        supportingLine={supportingLine(analysis.netPositionCents, analysis.outflow.totalCents, analysis.income.totalCents)}
        actionHref={analysis.isShortfall ? "/analysis/shortfall" : "/analysis"}
        actionLabel={analysis.isShortfall ? "What to do about it" : "See the full analysis"}
      />

      {analysis.warnings.slice(0, 2).map((warning) => (
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
          label="Income"
          value={formatMoney(analysis.income.totalCents)}
          hint={`${analysis.income.items.length} source(s)`}
          icon={<Wallet aria-hidden className="h-3.5 w-3.5" />}
          href="/financial/income"
        />
        <StatTile
          label="Spent so far"
          value={formatMoney(analysis.outflow.livingExpensesCents)}
          hint={`${formatMoney(analysis.averageDailySpendCents)} a day on average`}
          icon={<TrendingUp aria-hidden className="h-3.5 w-3.5" />}
          href="/financial/expenses"
        />
        <StatTile
          label="Fixed payments"
          value={formatMoney(analysis.outflow.financePaymentsCents)}
          hint="Every month, before anything else"
          icon={<CalendarClock aria-hidden className="h-3.5 w-3.5" />}
          href="/financial/finance-payments"
        />
        <StatTile
          label="Next month"
          value={formatMoney(analysis.projection.projectedNetCents)}
          hint={analysis.projection.isShortfall ? "Looks short - plan early" : "Bills and plans already counted"}
          tone={analysis.projection.isShortfall ? "warning" : "positive"}
          icon={<CalendarClock aria-hidden className="h-3.5 w-3.5" />}
          href="/analysis"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Your spending day by day"
            subtitle={`${formatMoney(analysis.monthToDateSpentCents)} in ${formatDate(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1), "MMMM")}`}
            action={
              <Link href="/financial/expenses" className="text-small font-medium text-accent hover:underline">
                See all
              </Link>
            }
          />
          {analysis.outflow.livingExpensesCents > 0 ? (
            <DailySpendStrip data={analysis.daily} />
          ) : (
            <EmptyState
              compact
              title="No spending recorded yet"
              description="Add your daily expenses and this chart fills in on its own."
              action={
                <ButtonLink href="/financial/expenses" size="sm" icon={<Plus aria-hidden className="h-4 w-4" />}>
                  Add an expense
                </ButtonLink>
              }
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Coming up"
            subtitle="Money dates in the next month"
            action={
              <Link href="/analysis" className="text-small font-medium text-accent hover:underline">
                Full analysis
              </Link>
            }
          />
          {upcoming.length === 0 ? (
            <EmptyState
              compact
              title="Nothing due soon"
              description="Add a finance payment or a pawned item and Fintarg will remind you before the date."
              action={<ButtonLink href="/financial/finance-payments" size="sm">Add a payment</ButtonLink>}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.slice(0, 5).map((item) => (
                <UpcomingRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {analysis.goals.length > 0 ? (
        <Card>
          <CardHeader
            title="Your goals"
            subtitle="Saved, still to go, and whether this month can carry it"
            action={
              <Link href="/goals" className="inline-flex items-center gap-1 text-small font-medium text-accent hover:underline">
                All goals
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            }
          />
          <ul className="grid gap-4 sm:grid-cols-2">
            {analysis.goals.slice(0, 4).map((goal) => (
              <li key={goal.goalId} className="rounded-card border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate text-small font-medium text-text">{goal.name}</p>
                  <Badge tone={goal.reason === "already_saved" ? "positive" : goal.achievable ? "positive" : "warning"}>
                    {goal.reason === "already_saved"
                      ? "Reached"
                      : goal.achievable
                        ? "On track"
                        : "Not possible yet"}
                  </Badge>
                </div>
                <ProgressBar savedCents={goal.savedCents} targetCents={goal.targetCents} label={goal.name} compact />
                {!goal.achievable && goal.reason !== "already_saved" ? (
                  <p className="mt-2 text-caption text-warning">{goal.message}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Quick actions" subtitle="The four things you will do most often" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ButtonLink href="/financial/expenses" variant="secondary" icon={<Plus aria-hidden className="h-4 w-4" />}>
            Add an expense
          </ButtonLink>
          <ButtonLink href="/financial/income" variant="secondary" icon={<Wallet aria-hidden className="h-4 w-4" />}>
            Add income
          </ButtonLink>
          <ButtonLink href="/goals" variant="secondary" icon={<Target aria-hidden className="h-4 w-4" />}>
            Save towards a goal
          </ButtonLink>
          <ButtonLink href="/medical" variant="secondary" icon={<HeartPulse aria-hidden className="h-4 w-4" />}>
            Medical record
          </ButtonLink>
        </div>
      </Card>

      {upcoming.some((item) => item.urgency === "overdue" || item.urgency === "urgent") ? (
        <p className="flex items-center gap-2 text-caption text-text-muted">
          <BellRing aria-hidden className="h-4 w-4" />
          Reminders are on by email. You can change the channel in Settings.
        </p>
      ) : null}
    </div>
  );
}

function supportingLine(netCents: number, outflowCents: number, incomeCents: number): string {
  if (incomeCents <= 0 && outflowCents <= 0) {
    return "Add your income and your regular payments to see this month's number.";
  }
  if (netCents < 0) {
    return `Your bills and plans cost more than your income this month. You need ${formatMoney(Math.abs(netCents))} more, or less spending.`;
  }
  return `After everything you have planned, ${formatMoney(netCents)} is still yours.`;
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const tone = {
    overdue: "danger",
    urgent: "danger",
    soon: "warning",
    later: "neutral",
  }[item.urgency] as "danger" | "warning" | "neutral";

  const label = {
    overdue: "Overdue",
    urgent: "Due soon",
    soon: "Coming up",
    later: "Later",
  }[item.urgency];

  const icon =
    item.urgency === "overdue" || item.urgency === "urgent" ? (
      <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
    ) : (
      <CalendarClock aria-hidden className="h-3.5 w-3.5" />
    );

  const content = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-small font-medium text-text">{item.title}</p>
        <p className="truncate text-caption text-text-muted">{item.detail}</p>
      </div>
      <div className="shrink-0 text-right">
        {item.amountCents ? (
          <p className="tabular text-small font-medium text-text">{formatMoney(item.amountCents)}</p>
        ) : null}
        <Badge tone={tone} icon={icon}>
          {label} · {relativeDayLabel(item.dueDate)}
        </Badge>
      </div>
    </div>
  );

  return (
    <li>
      {item.href ? (
        <Link
          href={item.href}
          className="flex min-h-touch items-center rounded-input border border-border p-3 transition-colors hover:bg-muted"
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-h-touch items-center rounded-input border border-border p-3">{content}</div>
      )}
    </li>
  );
}
