import { prisma } from "@/lib/db";
import {
  buildMonthlyAnalysis,
  type AnalysisInput,
  type ExpenseInput,
  type FinancePaymentInput,
  type GoalInput,
  type IncomeInput,
  type LoanInput,
  type PawnedItemInput,
  type MonthlyAnalysis,
} from "@/lib/finance/analysis";
import { monthRange, type MonthKey } from "@/lib/dates";

/**
 * Data access for the analysis engine. Every query is scoped by `userId` -
 * that single discipline is what enforces BR-8 (strict data isolation).
 */

export interface AnalysisBundle {
  analysis: MonthlyAnalysis;
  raw: {
    incomes: IncomeInput[];
    expenses: ExpenseInput[];
    financePayments: FinancePaymentInput[];
    loans: LoanInput[];
    pawnedItems: PawnedItemInput[];
    goals: GoalInput[];
    plannedPersonalCents: number;
  };
}

export async function loadAnalysis(
  userId: string,
  month: MonthKey,
  options: { today?: Date } = {},
): Promise<AnalysisBundle> {
  const { start, end } = monthRange(month);
  // Look one month back so a goal or loan created last month still contributes
  // interest to this month's analysis.
  const historyStart = new Date(start.getFullYear(), start.getMonth() - 3, 1);

  const [incomes, expenses, financePayments, loans, pawnedItems, goalRows, plan] = await Promise.all([
    prisma.income.findMany({
      where: { userId, deletedAt: null, date: { gte: historyStart, lte: end } },
      orderBy: { date: "desc" },
    }),
    prisma.expense.findMany({
      where: { userId, deletedAt: null, date: { gte: historyStart, lte: end } },
      orderBy: { date: "desc" },
    }),
    prisma.financePayment.findMany({ where: { userId, deletedAt: null, active: true } }),
    prisma.loan.findMany({ where: { userId, deletedAt: null } }),
    prisma.pawnedItem.findMany({ where: { userId, deletedAt: null } }),
    prisma.savingsGoal.findMany({
      where: { userId, deletedAt: null },
      include: { contributions: true },
    }),
    prisma.personalSpendingPlan.findUnique({ where: { userId_month: { userId, month } } }),
  ]);

  const mappedIncomes: IncomeInput[] = incomes.map((income) => ({
    id: income.id,
    sourceName: income.sourceName,
    kind: income.kind as IncomeInput["kind"],
    amountCents: income.amountCents,
    frequency: income.frequency as IncomeInput["frequency"],
    date: income.date,
    recurring: income.recurring,
    customIntervalDays: income.customIntervalDays,
  }));

  const mappedExpenses: ExpenseInput[] = expenses.map((expense) => ({
    id: expense.id,
    date: expense.date,
    amountCents: expense.amountCents,
    categoryName: expense.categoryName,
    recurring: expense.recurring,
    isMedical: expense.isMedical,
    isPersonal: expense.isPersonal,
  }));

  const mappedPayments: FinancePaymentInput[] = financePayments.map((payment) => ({
    id: payment.id,
    lender: payment.lender,
    description: payment.description,
    amountCents: payment.amountCents,
    dueDayOfMonth: payment.dueDayOfMonth,
    monthsRemaining: payment.monthsRemaining,
    active: payment.active,
  }));

  const mappedLoans: LoanInput[] = loans.map((loan) => ({
    id: loan.id,
    lender: loan.lender,
    principalCents: loan.principalCents,
    interestRatePct: loan.interestRatePct,
    method: loan.method as LoanInput["method"],
    remainingBalanceCents: loan.remainingBalanceCents,
    manualMonthlyInterestCents: loan.manualMonthlyInterestCents,
    dueDate: loan.dueDate,
  }));

  const mappedPawned: PawnedItemInput[] = pawnedItems.map((item) => ({
    id: item.id,
    description: item.description,
    amountReceivedCents: item.amountReceivedCents,
    interestRatePct: item.interestRatePct,
    monthlyInterestCents: item.monthlyInterestCents,
    nextInterestDueDate: item.nextInterestDueDate,
    redemptionDate: item.redemptionDate,
  }));

  const mappedGoals: GoalInput[] = goalRows.map((goal) => ({
    id: goal.id,
    name: goal.name,
    targetAmountCents: goal.targetAmountCents,
    savedCents: goal.contributions.reduce((total, contribution) => total + contribution.amountCents, 0),
    mode: goal.mode as GoalInput["mode"],
    dailyAmountCents: goal.dailyAmountCents,
    monthlyTargetCents: goal.monthlyTargetCents,
    endDate: goal.endDate,
  }));

  const input: AnalysisInput = {
    month,
    today: options.today,
    incomes: mappedIncomes,
    expenses: mappedExpenses,
    financePayments: mappedPayments,
    loans: mappedLoans,
    pawnedItems: mappedPawned,
    goals: mappedGoals,
    plannedPersonalCents: plan?.plannedAmountCents ?? 0,
  };

  return {
    analysis: buildMonthlyAnalysis(input),
    raw: {
      incomes: mappedIncomes,
      expenses: mappedExpenses,
      financePayments: mappedPayments,
      loans: mappedLoans,
      pawnedItems: mappedPawned,
      goals: mappedGoals,
      plannedPersonalCents: plan?.plannedAmountCents ?? 0,
    },
  };
}

/** Recompute a goal's derived daily/monthly amounts (BR-4). */
export function deriveGoalAmounts(input: {
  targetAmountCents: number;
  mode: "daily" | "monthly";
  daysInMonth: number;
}): { dailyAmountCents: number; monthlyTargetCents: number } {
  if (input.mode === "daily") {
    const daily = Math.ceil(input.targetAmountCents / Math.max(1, input.daysInMonth));
    return { dailyAmountCents: daily, monthlyTargetCents: daily * input.daysInMonth };
  }
  const monthly = Math.min(input.targetAmountCents, Math.max(0, input.targetAmountCents));
  const daily = Math.ceil(monthly / Math.max(1, input.daysInMonth));
  return { dailyAmountCents: daily, monthlyTargetCents: monthly };
}
