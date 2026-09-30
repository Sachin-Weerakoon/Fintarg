import { redirect } from "next/navigation";
import {
  Banknote,
  CreditCard,
  Gem,
  PiggyBank,
  Receipt,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { loadAnalysis } from "@/lib/finance/load";
import { currentMonthKey, formatMonthLabel } from "@/lib/dates";
import { formatMoney, type Cents } from "@/lib/money";
import { PageHeader } from "@/components/layout/PageHeader";
import { NetPositionCard } from "@/components/NetPositionCard";
import { Card, SectionTitle } from "@/components/ui/Card";

/**
 * Financial hub (FR-13). One card per sub-section, each showing what the user
 * committed to this month, so the whole money picture is one scroll away.
 */
export default async function FinancialPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const month = currentMonthKey();
  const { analysis, raw } = await loadAnalysis(user.id, month);

  const sections: {
    href: string;
    title: string;
    icon: React.ReactNode;
    totalCents: Cents;
    hint: string;
    tone: "neutral" | "positive" | "warning" | "danger" | "accent";
  }[] = [
    {
      href: "/financial/income",
      title: "Income",
      icon: <Banknote aria-hidden className="h-4 w-4" />,
      totalCents: analysis.income.totalCents,
      hint: `${raw.incomes.length} source(s) recorded`,
      tone: "positive",
    },
    {
      href: "/financial/expenses",
      title: "Expenses",
      icon: <Receipt aria-hidden className="h-4 w-4" />,
      totalCents: analysis.outflow.livingExpensesCents,
      hint: `${formatMoney(analysis.averageDailySpendCents)} a day on average`,
      tone: "neutral",
    },
    {
      href: "/financial/finance-payments",
      title: "Finance payments",
      icon: <CreditCard aria-hidden className="h-4 w-4" />,
      totalCents: analysis.outflow.financePaymentsCents,
      hint: `${raw.financePayments.length} active payment(s)`,
      tone: "neutral",
    },
    {
      href: "/financial/loans",
      title: "Loans",
      icon: <TrendingDown aria-hidden className="h-4 w-4" />,
      totalCents: analysis.outflow.loanInterestCents,
      hint: `Interest this month · ${raw.loans.length} loan(s)`,
      tone: "warning",
    },
    {
      href: "/financial/pawned",
      title: "Pawned items",
      icon: <Gem aria-hidden className="h-4 w-4" />,
      totalCents: analysis.outflow.pawnInterestCents,
      hint: `Interest this month · ${raw.pawnedItems.length} item(s)`,
      tone: "warning",
    },
    {
      href: "/financial/personal-spending",
      title: "Personal spending plan",
      icon: <Sparkles aria-hidden className="h-4 w-4" />,
      totalCents: raw.plannedPersonalCents,
      hint: `${formatMoney(analysis.actualPersonalSpendingCents)} used so far`,
      tone: "accent",
    },
  ];

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Financial"
        description={`Everything you earn, spend, owe and have pledged, in one place. Showing ${formatMonthLabel(month)}.`}
      />

      <NetPositionCard
        month={month}
        netPositionCents={analysis.netPositionCents}
        incomeCents={analysis.income.totalCents}
        outflowCents={analysis.outflow.totalCents}
        supportingLine={
          analysis.isShortfall
            ? `Your bills and plans are ${formatMoney(Math.abs(analysis.netPositionCents))} more than your income this month.`
            : `After your bills and plans, ${formatMoney(analysis.netPositionCents)} is left this month.`
        }
      />

      <section aria-labelledby="financial-sections-heading" className="flex flex-col gap-4">
        <SectionTitle hint="Each card shows the figure for this month. Tap a card to add or change records.">
          <span id="financial-sections-heading">Your money, by part</span>
        </SectionTitle>

        <ul className="grid gap-3 sm:grid-cols-2">
          {sections.map((section) => (
            <li key={section.href}>
              <Card as="div" className="h-full">
                <Link
                  href={section.href}
                  className="flex h-full flex-col gap-1 rounded-input focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className="flex items-center gap-2 text-caption font-medium uppercase tracking-wide text-text-muted">
                    {section.icon}
                    {section.title}
                  </span>
                  <span className="tabular text-h1 font-semibold text-text">
                    {formatMoney(section.totalCents)}
                  </span>
                  <span className="text-caption text-text-muted">{section.hint}</span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <Card tone="accent">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-small font-medium text-text">
              <PiggyBank aria-hidden className="h-4 w-4 text-accent" />
              Next month looks like this
            </p>
            <p className="mt-1 text-small text-text-muted">
              {analysis.projection.isShortfall
                ? `${formatMonthLabel(analysis.projection.month)} looks short by ${formatMoney(Math.abs(analysis.projection.projectedNetCents))}.`
                : `${formatMonthLabel(analysis.projection.month)} looks like ${formatMoney(analysis.projection.projectedNetCents)} left after your known bills.`}
            </p>
          </div>
          <Link
            href="/analysis"
            className="inline-flex min-h-touch shrink-0 items-center justify-center rounded-pill bg-accent px-4 py-2 text-small font-medium text-accent-contrast transition-[filter] hover:brightness-110"
          >
            See the full analysis
          </Link>
        </div>
      </Card>
    </div>
  );
}
