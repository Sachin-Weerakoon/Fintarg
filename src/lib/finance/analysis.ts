/**
 * Monthly analysis engine (FR-5, BR-1 .. BR-6).
 *
 * The engine is pure: it takes a plain `AnalysisInput` and returns a plain
 * `MonthlyAnalysis`. Nothing here touches the database, so the exact same code
 * powers the dashboard, the next-month projection, the PDF export and the unit
 * tests.
 *
 * Worked example from the specification:
 *   income 50,000 + finance payments 25,000 + living expenses 30,000
 *   -> total outflow 55,000 -> shortfall 5,000
 *   -> a 30,000 savings goal is flagged unachievable.
 */

import { addDays, addMonths, endOfMonth, startOfMonth } from "date-fns";
import { daysInMonth, monthRange, toMonthKey, type MonthKey } from "@/lib/dates";
import type { Cents } from "@/lib/money";

export interface IncomeInput {
  id: string;
  sourceName: string;
  kind: "salary" | "business" | "other";
  amountCents: Cents;
  frequency: "monthly" | "one_time" | "custom";
  date: Date;
  recurring: boolean;
  customIntervalDays?: number | null;
}

export interface ExpenseInput {
  id: string;
  date: Date;
  amountCents: Cents;
  categoryName: string;
  recurring: boolean;
  isMedical: boolean;
  isPersonal: boolean;
}

export interface FinancePaymentInput {
  id: string;
  lender: string;
  description: string;
  amountCents: Cents;
  dueDayOfMonth: number;
  monthsRemaining?: number | null;
  /** First instalment. A payment does not count in any month before this. */
  startDate: Date;
  active: boolean;
}

export type LoanMethod = "flat" | "reducing" | "simple" | "compound";

export interface LoanInput {
  id: string;
  lender: string;
  principalCents: Cents;
  interestRatePct: number;
  method: LoanMethod;
  remainingBalanceCents: Cents;
  manualMonthlyInterestCents?: number | null;
  /** Interest only accrues from this month onwards. */
  startDate: Date;
  dueDate?: Date | null;
}

export interface PawnedItemInput {
  id: string;
  description: string;
  amountReceivedCents: Cents;
  interestRatePct: number;
  monthlyInterestCents: Cents;
  nextInterestDueDate?: Date | null;
  redemptionDate?: Date | null;
}

export interface GoalInput {
  id: string;
  name: string;
  targetAmountCents: Cents;
  savedCents: Cents;
  mode: "daily" | "monthly";
  dailyAmountCents: Cents;
  monthlyTargetCents: Cents;
  endDate?: Date | null;
}

export interface AnalysisInput {
  month: MonthKey;
  today?: Date;
  incomes: IncomeInput[];
  expenses: ExpenseInput[];
  financePayments: FinancePaymentInput[];
  loans: LoanInput[];
  pawnedItems: PawnedItemInput[];
  goals: GoalInput[];
  plannedPersonalCents?: Cents;
  /** Recurring non-recurring-flagged expenses, already scoped to the month. */
  recurringExpenseIds?: string[];
}

export interface LineItem {
  key: string;
  label: string;
  amountCents: Cents;
  detail?: string;
  href?: string;
}

export interface ObligationItem {
  key: string;
  label: string;
  amountCents: Cents;
  dueDay?: number;
  dueDate?: Date | null;
  detail?: string;
}

export interface GoalFeasibility {
  goalId: string;
  name: string;
  targetCents: Cents;
  savedCents: Cents;
  remainingCents: Cents;
  /** What the goal's own schedule asks for in the remaining days of this month. */
  requiredThisMonthCents: Cents;
  /** The part of that requirement this month's free cash can actually fund. */
  plannedCents: Cents;
  freeCashCents: Cents;
  achievable: boolean;
  dailyRemainingCents: Cents;
  daysLeftInMonth: number;
  reason:
    | "on_track"
    | "free_cash_short"
    | "already_saved"
    | "no_target";
  message: string;
}

export interface MonthlyAnalysis {
  month: MonthKey;
  /** Signed: positive = remaining money, negative = shortfall. */
  netPositionCents: Cents;
  isShortfall: boolean;

  income: {
    totalCents: Cents;
    recurringCents: Cents;
    oneOffCents: Cents;
    items: LineItem[];
  };
  outflow: {
    livingExpensesCents: Cents;
    financePaymentsCents: Cents;
    loanInterestCents: Cents;
    pawnInterestCents: Cents;
    plannedPersonalCents: Cents;
    savingsCents: Cents;
    /** BR-1: living expenses + finance payments + loan interest + planned personal + savings */
    totalCents: Cents;
    breakdown: LineItem[];
  };
  actualPersonalSpendingCents: Cents;
  /** Every expense this month, personal included. A total, not an outflow term. */
  totalSpentCents: Cents;
  personalPlanUsagePct: number;
  personalPlanRemainingCents: Cents;
  personalPlanStatus: "ok" | "near_limit" | "over";

  freeCashCents: Cents;
  cashBeforeSavingsCents: Cents;
  /** D6: income minus what every goal asks for this month. Display only. */
  leftAfterGoalsCents: Cents;

  daily: { date: Date; spentCents: Cents }[];
  monthToDateSpentCents: Cents;
  averageDailySpendCents: Cents;
  categoryTotals: { category: string; amountCents: Cents; sharePct: number }[];

  goals: GoalFeasibility[];

  projection: {
    month: MonthKey;
    incomeCents: Cents;
    obligations: ObligationItem[];
    obligationsTotalCents: Cents;
    projectedExpensesCents: Cents;
    projectedTotalOutflowCents: Cents;
    projectedNetCents: Cents;
    isShortfall: boolean;
  };

  warnings: AnalysisWarning[];
}

export interface AnalysisWarning {
  id: string;
  level: "info" | "warning" | "danger";
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

const MS_DAY = 86_400_000;

/** Difference between two month keys, counting the start month as 0. */
export function monthDistance(from: MonthKey, to: MonthKey): number {
  const a = monthKeyToDate(from);
  const b = monthKeyToDate(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/**
 * Does a finance payment land in this month?
 *
 * A payment counts from its start month until `monthsRemaining` instalments have
 * been paid. `monthsRemaining` is the *total* number of instalments, so the
 * last one falls in `startMonth + monthsRemaining - 1` - the exclusive upper
 * bound below. An indefinite payment (null) never ends.
 */
export function paymentCountsInMonth(payment: FinancePaymentInput, month: MonthKey): boolean {
  if (!payment.active) return false;
  const startMonth = toMonthKey(payment.startDate);
  const offset = monthDistance(startMonth, month);
  if (offset < 0) return false;
  if (payment.monthsRemaining == null) return true;
  return offset < payment.monthsRemaining;
}

/** Instalments still to pay from today, for "N payments left" (FR-2.3). */
export function paymentsRemainingFrom(
  payment: FinancePaymentInput,
  today = new Date(),
): number | null {
  if (payment.monthsRemaining == null) return null;
  const startMonth = toMonthKey(payment.startDate);
  const paidThrough = monthDistance(startMonth, toMonthKey(today));
  return Math.max(0, payment.monthsRemaining - Math.max(0, paidThrough));
}

/**
 * Loan interest due in a given month (BR-3: interest reduces future remaining money).
 *
 * Order matters and follows the specification:
 *  1. a manually recorded monthly amount always wins;
 *  2. nothing accrues before the start month or after the due month;
 *  3. `reducing`  - remaining balance x rate / 12
 *  4. `simple`/`flat` - original principal x rate / 12
 *  5. `compound`  - one month of monthly compounding from the start month:
 *     `P x ((1+r/12)^n - (1+r/12)^(n-1))`, with `n` whole months since the
 *     start month (the start month itself is n = 1). Rounded once, at the end,
 *     so the working never accumulates float drift into stored cents.
 */
export function loanMonthlyInterestCents(loan: LoanInput, month: MonthKey): Cents {
  if (loan.manualMonthlyInterestCents != null && loan.manualMonthlyInterestCents > 0) {
    return loan.manualMonthlyInterestCents;
  }

  const startMonth = toMonthKey(loan.startDate);
  const offset = monthDistance(startMonth, month);
  if (offset < 0) return 0;
  // A positive distance means `month` is *after* the loan finished.
  if (loan.dueDate && monthDistance(toMonthKey(loan.dueDate), month) > 0) return 0;

  const rate = (loan.interestRatePct || 0) / 100;
  if (rate <= 0) return 0;
  const monthlyRate = rate / 12;

  if (loan.method === "compound") {
    const n = offset + 1; // the start month is the first compounding period
    const principal = loan.remainingBalanceCents;
    const growth = Math.pow(1 + monthlyRate, n) - Math.pow(1 + monthlyRate, n - 1);
    return Math.round(principal * growth);
  }

  if (loan.method === "simple" || loan.method === "flat") {
    return Math.round(loan.principalCents * monthlyRate);
  }

  return Math.round(loan.remainingBalanceCents * monthlyRate);
}

/**
 * Does pawn interest fall due in this month? (D1)
 *
 * With a recorded due date it only lands in that month; without one it is
 * assumed to be payable every month until the item is redeemed.
 */
export function pawnInterestDueInMonth(item: PawnedItemInput, month: MonthKey): boolean {
  // Once the item has been redeemed in an earlier month, nothing is due.
  if (item.redemptionDate && monthDistance(toMonthKey(item.redemptionDate), month) > 0) return false;
  if (!item.nextInterestDueDate) return true;
  return toMonthKey(item.nextInterestDueDate) === month;
}

/** Pawn interest due in the month: recorded amount, else amount x annual rate / 12. */
export function pawnMonthlyInterestCents(item: PawnedItemInput): Cents {
  if (item.monthlyInterestCents > 0) return item.monthlyInterestCents;
  const rate = (item.interestRatePct || 0) / 100;
  if (rate <= 0) return 0;
  return Math.round(item.amountReceivedCents * (rate / 12));
}

function inRange(date: Date, month: MonthKey): boolean {
  const { start, end } = monthRange(month);
  return date >= start && date <= end;
}

/** Income that lands inside the month (FR-2 recurring projection). */
export function incomeForMonth(incomes: IncomeInput[], month: MonthKey): IncomeInput[] {
  const { start } = monthRange(month);
  return incomes.filter((income) => {
    if (inRange(income.date, month)) return true;
    // B6: a `monthly` source is recurring even when the "repeat every month"
    // box was never ticked, so a salary entered 8 months ago still counts.
    if (isRecurringIncome(income)) {
      const prior = addMonths(start, -1);
      return income.date <= endOfMonth(prior);
    }
    if (income.frequency === "custom" && income.recurring && income.customIntervalDays) {
      const elapsedDays = Math.round((start.getTime() - income.date.getTime()) / MS_DAY);
      return elapsedDays >= 0 && elapsedDays % income.customIntervalDays === 0;
    }
    return false;
  });
}

/** A monthly source counts as recurring whether or not the flag was ticked. */
export function isRecurringIncome(income: IncomeInput): boolean {
  return income.recurring || income.frequency === "monthly";
}

export function buildMonthlyAnalysis(input: AnalysisInput): MonthlyAnalysis {
  const { month } = input;
  const today = input.today ?? new Date();
  const { start, end } = monthRange(month);
  const totalDays = daysInMonth(month);
  const isCurrentMonth =
    start.getTime() <= today.getTime() && today.getTime() <= end.getTime() + MS_DAY;
  const daysLeftInMonth = isCurrentMonth
    ? Math.max(1, daysInMonth(month) - today.getDate() + 1)
    : totalDays;
  const elapsedDays = isCurrentMonth ? today.getDate() : totalDays;

  /* ---------------------------------------------------------------- income */
  const monthIncomes = incomeForMonth(input.incomes, month);
  const incomeTotal = monthIncomes.reduce((total, income) => total + income.amountCents, 0);
  const incomeRecurring = monthIncomes
    .filter((income) => income.frequency === "monthly" || income.frequency === "custom")
    .reduce((total, income) => total + income.amountCents, 0);
  const incomeOneOff = incomeTotal - incomeRecurring;

  /* -------------------------------------------------------------- expenses */
  const monthExpenses = input.expenses.filter((expense) => inRange(expense.date, month));
  // D2: "living expenses" is every expense that is *not* personal spending, so
  // medical is included. Personal spending is reported on its own line below
  // and must never be counted a second time inside this figure (B1).
  const nonPersonalExpenses = monthExpenses.filter((expense) => !expense.isPersonal);
  const livingExpensesTotal = nonPersonalExpenses.reduce((total, e) => total + e.amountCents, 0);
  const actualPersonal = monthExpenses
    .filter((expense) => expense.isPersonal)
    .reduce((total, expense) => total + expense.amountCents, 0);
  // Everything actually spent this month, for the daily strip and the
  // month-to-date figure. This is a total, not an outflow component.
  const totalSpent = monthExpenses.reduce((total, expense) => total + expense.amountCents, 0);
  const medicalTotal = monthExpenses
    .filter((expense) => expense.isMedical)
    .reduce((total, expense) => total + expense.amountCents, 0);

  /* ------------------------------------------------- finance payments (BR-1) */
  const duePayments = input.financePayments.filter((payment) => paymentCountsInMonth(payment, month));
  const activePayments = input.financePayments.filter((payment) => payment.active);
  const financeTotal = duePayments.reduce((total, payment) => total + payment.amountCents, 0);

  /* -------------------------------------------------------- loan + pawn interest */
  const loanInterestTotal = input.loans.reduce(
    (total, loan) => total + loanMonthlyInterestCents(loan, month),
    0,
  );
  // D1: pawn interest is a real cash outflow, but only in the month it falls due.
  const pawnInterestTotal = input.pawnedItems
    .filter((item) => pawnInterestDueInMonth(item, month))
    .reduce((total, item) => total + pawnMonthlyInterestCents(item), 0);

  /* ------------------------------------------------------- planned personal */
  const plannedPersonal = Math.max(0, input.plannedPersonalCents ?? 0);
  // D2: the personal line is the larger of what was planned and what was spent.
  const personalOutflow = Math.max(plannedPersonal, actualPersonal);
  const personalUsagePct = plannedPersonal > 0 ? Math.round((actualPersonal / plannedPersonal) * 100) : 0;
  const personalPlanStatus: "ok" | "near_limit" | "over" =
    plannedPersonal <= 0
      ? "ok"
      : actualPersonal >= plannedPersonal
        ? "over"
        : personalUsagePct >= 80
          ? "near_limit"
          : "ok";

  /* ------------------------------------------------------------------ goals */
  // Free cash is measured *before* savings, so goal feasibility never feeds
  // back into itself.
  const freeCash =
    incomeTotal - (livingExpensesTotal + financeTotal + loanInterestTotal + pawnInterestTotal + personalOutflow);

  const goals: GoalFeasibility[] = input.goals.map((goal) =>
    evaluateGoal(goal, freeCash, daysLeftInMonth, month, totalDays),
  );

  /* --------------------------------------------------------------- savings */
  // A goal that free cash cannot cover is flagged, not budgeted. Budgeting an
  // impossible saving would turn a real shortfall into a bigger one and hide it.
  const savingsRequired = goals.reduce((total, goal) => total + goal.plannedCents, 0);

  /* ------------------------------------------------------------- BR-1/BR-2 */
  // BR-1 now also includes pawn interest. Every term below appears exactly once
  // in `breakdown`, so the lines always reconcile to the total.
  const outflowTotal =
    livingExpensesTotal +
    financeTotal +
    loanInterestTotal +
    pawnInterestTotal +
    personalOutflow +
    savingsRequired;

  const netPosition = incomeTotal - outflowTotal;
  const cashBeforeSavings = netPosition + savingsRequired;

  /* ------------------------------------------- D6: what is left after goals */
  const goalsRequiredThisMonth = goals.reduce((total, goal) => total + goal.requiredThisMonthCents, 0);
  const leftAfterGoals = incomeTotal - goalsRequiredThisMonth;

  /* ------------------------------------------------------------- projection */
  const nextMonth = monthKeyFromOffset(month, 1);
  const projectionIncome = monthIncomes
    .filter((income) => income.recurring || income.frequency === "monthly" || income.frequency === "custom")
    .reduce((total, income) => total + income.amountCents, 0);
  const projectionObligations: ObligationItem[] = duePayments
    .filter((payment) => paymentCountsInMonth(payment, nextMonth))
    .map((payment) => {
      const left = paymentsRemainingFrom(payment, endOfMonth(monthKeyToDate(month)));
      return {
        key: `finance:${payment.id}`,
        label: `${payment.lender} - ${payment.description}`,
        amountCents: payment.amountCents,
        dueDay: payment.dueDayOfMonth,
        dueDate: dueDateInMonth(payment.dueDayOfMonth, nextMonth),
        detail: left == null ? "Ongoing" : `${left} payment(s) left`,
      };
    });
  const projectionPawn: ObligationItem[] = input.pawnedItems
    .map((item) => ({ item, interest: pawnMonthlyInterestCents(item) }))
    .filter((entry) => entry.interest > 0 && pawnInterestDueInMonth(entry.item, nextMonth))
    .map(({ item, interest }) => ({
      key: `pawn:${item.id}`,
      label: `Pawn interest - ${item.description}`,
      amountCents: interest,
      dueDate: item.nextInterestDueDate,
      detail: item.nextInterestDueDate
        ? `Next interest due ${item.nextInterestDueDate.getDate()} ${item.nextInterestDueDate.toLocaleString("en-GB", { month: "short" })}`
        : undefined,
    }));
  projectionObligations.push(...projectionPawn);
  // Same function, next month: a loan that has not started yet accrues nothing.
  const projectionLoanInterest = input.loans.reduce(
    (total, loan) => total + loanMonthlyInterestCents(loan, nextMonth),
    0,
  );
  if (projectionLoanInterest > 0) {
    projectionObligations.push({
      key: "loan:interest",
      label: "Loan interest",
      amountCents: projectionLoanInterest,
      detail: "Estimated from your current balances",
    });
  }
  const obligationsTotal = projectionObligations.reduce((total, item) => total + item.amountCents, 0);

  // Baseline living cost for next month: this month's actual non-personal
  // spending, or the daily average when this month is still young. Personal
  // spending is excluded here because it is added once below as `personalOutflow`.
  const nonPersonalDaily = buildDailySeries(nonPersonalExpenses, month);
  const averageDaily = nonPersonalDaily.length
    ? Math.round(
        nonPersonalDaily.reduce((total, day) => total + day.spentCents, 0) / Math.max(1, elapsedDays),
      )
    : 0;
  const projectedExpenses = averageDaily > 0 ? averageDaily * totalDays : livingExpensesTotal;
  const projectedSavings = savingsRequired;
  const projectedOutflow = projectedExpenses + obligationsTotal + personalOutflow + projectedSavings;
  const projectedNet = projectionIncome - projectedOutflow;

  /* ---------------------------------------------------------------- charts */
  const categoryTotals = buildCategoryTotals(monthExpenses);
  const monthToDateSpent = totalSpent;
  const dailySeries = buildDailySeries(monthExpenses, month);

  const projection = {
    month: nextMonth,
    incomeCents: projectionIncome,
    obligations: projectionObligations,
    obligationsTotalCents: obligationsTotal,
    projectedExpensesCents: projectedExpenses,
    projectedTotalOutflowCents: projectedOutflow,
    projectedNetCents: projectedNet,
    isShortfall: projectedNet < 0,
  };

  /* --------------------------------------------------------------- warnings */
  const warnings = buildWarnings({
    month,
    netPositionCents: netPosition,
    freeCashCents: freeCash,
    plannedPersonalCents: plannedPersonal,
    actualPersonalCents: actualPersonal,
    personalPlanStatus,
    goals,
    projection,
    medicalTotal,
    activePayments,
    pawnedItems: input.pawnedItems,
    loans: input.loans,
  });

  return {
    month,
    netPositionCents: netPosition,
    isShortfall: netPosition < 0,
    income: {
      totalCents: incomeTotal,
      recurringCents: incomeRecurring,
      oneOffCents: incomeOneOff,
      items: monthIncomes.map((income) => ({
        key: income.id,
        label: income.sourceName,
        amountCents: income.amountCents,
        detail: income.frequency === "one_time" ? "One-time" : income.recurring ? "Every month" : "This month",
        href: "/financial/income",
      })),
    },
    outflow: {
      livingExpensesCents: livingExpensesTotal,
      financePaymentsCents: financeTotal,
      loanInterestCents: loanInterestTotal,
      pawnInterestCents: pawnInterestTotal,
      plannedPersonalCents: personalOutflow,
      savingsCents: savingsRequired,
      /** BR-1: living + finance payments + loan interest + pawn interest + personal + savings */
      totalCents: outflowTotal,
      breakdown: [
        {
          key: "living",
          label: "Living expenses",
          amountCents: livingExpensesTotal,
          detail: nonPersonalExpenses.length ? `${nonPersonalExpenses.length} entries` : "Nothing recorded yet",
          href: "/financial/expenses",
        },
        {
          key: "finance",
          label: "Finance payments",
          amountCents: financeTotal,
          detail: `${duePayments.length} due this month`,
          href: "/financial/finance-payments",
        },
        {
          key: "loan-interest",
          label: "Loan interest",
          amountCents: loanInterestTotal,
          detail: `${input.loans.length} loan(s)`,
          href: "/financial/loans",
        },
        {
          key: "pawn-interest",
          label: "Pawn interest",
          amountCents: pawnInterestTotal,
          detail: `${input.pawnedItems.length} item(s)`,
          href: "/financial/pawned",
        },
        {
          key: "personal-plan",
          label: "Planned personal spending",
          amountCents: personalOutflow,
          detail:
            plannedPersonal > 0
              ? `Rs. ${Math.round(actualPersonal / 100).toLocaleString("en-LK")} spent of Rs. ${Math.round(plannedPersonal / 100).toLocaleString("en-LK")} plan`
              : actualPersonal > 0
                ? "No monthly plan set"
                : "No monthly plan set",
          href: "/financial/personal-spending",
        },
        {
          key: "savings",
          label: "Savings",
          amountCents: savingsRequired,
          detail: goals.length ? `${goals.length} goal(s) in progress` : "No goals yet",
          href: "/goals",
        },
      ],
    },
    actualPersonalSpendingCents: actualPersonal,
    totalSpentCents: totalSpent,
    personalPlanUsagePct: personalUsagePct,
    personalPlanRemainingCents: plannedPersonal - actualPersonal,
    personalPlanStatus,
    freeCashCents: freeCash,
    cashBeforeSavingsCents: cashBeforeSavings,
    leftAfterGoalsCents: leftAfterGoals,
    daily: dailySeries,
    monthToDateSpentCents: monthToDateSpent,
    averageDailySpendCents: averageDaily,
    categoryTotals,
    goals,
    projection,
    warnings,
  };
}

function monthKeyFromOffset(month: MonthKey, offset: number): MonthKey {
  const shifted = addMonths(startOfMonth(monthKeyToDate(month)), offset);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyToDate(month: MonthKey): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, (monthNumber ?? 1) - 1, 1);
}

function dueDateInMonth(dayOfMonth: number, month: MonthKey): Date {
  const base = monthKeyToDate(month);
  const maxDay = endOfMonth(base).getDate();
  return new Date(base.getFullYear(), base.getMonth(), Math.min(Math.max(1, dayOfMonth), maxDay));
}

function itemStillActive(item: PawnedItemInput, month: MonthKey): boolean {
  if (!item.redemptionDate) return true;
  return item.redemptionDate <= endOfMonth(monthKeyToDate(month));
}

/**
 * How much of a goal's schedule still falls due in the remaining days of this
 * month (BR-4: a daily target times the days in the month is the monthly
 * target, so a daily goal asks for `daily x days left` from today).
 */
function requiredThisMonth(goal: GoalInput, month: MonthKey, daysLeft: number): Cents {
  if (goal.targetAmountCents <= 0) return 0;
  const remaining = Math.max(0, goal.targetAmountCents - goal.savedCents);
  if (remaining === 0) return 0;
  const total = daysInMonth(month);

  if (goal.mode === "monthly" && goal.monthlyTargetCents > 0) {
    return Math.min(remaining, Math.round((goal.monthlyTargetCents * daysLeft) / total));
  }
  if (goal.dailyAmountCents > 0) {
    return Math.min(remaining, goal.dailyAmountCents * daysLeft);
  }
  if (goal.monthlyTargetCents > 0) {
    return Math.min(remaining, Math.round((goal.monthlyTargetCents * daysLeft) / total));
  }
  return 0;
}

/** BR-5: flag a goal unachievable when free cash is below what is required. */
function evaluateGoal(
  goal: GoalInput,
  freeCashCents: Cents,
  daysLeftInMonth: number,
  month: MonthKey,
  totalDays: number,
): GoalFeasibility {
  const remaining = Math.max(0, goal.targetAmountCents - goal.savedCents);
  const required = requiredThisMonth(goal, month, daysLeftInMonth);
  const perDayTarget = goal.dailyAmountCents > 0
    ? goal.dailyAmountCents
    : goal.monthlyTargetCents > 0
      ? Math.round(goal.monthlyTargetCents / totalDays)
      : 0;

  if (goal.targetAmountCents <= 0) {
    return {
      goalId: goal.id,
      name: goal.name,
      targetCents: 0,
      savedCents: goal.savedCents,
      remainingCents: 0,
      requiredThisMonthCents: 0,
      plannedCents: 0,
      freeCashCents,
      achievable: true,
      dailyRemainingCents: 0,
      daysLeftInMonth,
      reason: "no_target",
      message: "Add a target amount to start tracking this goal.",
    };
  }

  if (remaining === 0) {
    return {
      goalId: goal.id,
      name: goal.name,
      targetCents: goal.targetAmountCents,
      savedCents: goal.savedCents,
      remainingCents: 0,
      requiredThisMonthCents: 0,
      plannedCents: 0,
      freeCashCents,
      achievable: true,
      dailyRemainingCents: 0,
      daysLeftInMonth,
      reason: "already_saved",
      message: "You have reached this goal. Well done.",
    };
  }

  const dailyRemaining = Math.ceil(remaining / Math.max(1, daysLeftInMonth));
  const achievable = required > 0 && freeCashCents >= required;
  const plannedCents = Math.min(required, Math.max(0, freeCashCents));

  return {
    goalId: goal.id,
    name: goal.name,
    targetCents: goal.targetAmountCents,
    savedCents: goal.savedCents,
    remainingCents: remaining,
    requiredThisMonthCents: required,
    plannedCents,
    freeCashCents,
    achievable,
    dailyRemainingCents: dailyRemaining,
    daysLeftInMonth,
    reason: achievable ? "on_track" : "free_cash_short",
    message: achievable
      ? `Save about ${formatShort(perDayTarget)} a day to stay on track.`
      : `After this month's bills you have ${formatShort(freeCashCents)} free, so saving ${formatShort(required)} is not possible yet.`,
  };
}

function formatShort(cents: Cents): string {
  return `Rs. ${Math.round(Math.abs(cents) / 100).toLocaleString("en-LK")}`;
}

function buildDailySeries(expenses: ExpenseInput[], month: MonthKey) {
  const base = monthKeyToDate(month);
  const total = daysInMonth(month);
  const buckets = new Map<string, Cents>();
  for (let day = 1; day <= total; day += 1) buckets.set(`${day}`, 0);
  for (const expense of expenses) {
    if (!inRange(expense.date, month)) continue;
    const key = String(expense.date.getDate());
    buckets.set(key, (buckets.get(key) ?? 0) + expense.amountCents);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([day, spentCents]) => ({ date: new Date(base.getFullYear(), base.getMonth(), Number(day)), spentCents }));
}

function buildCategoryTotals(expenses: ExpenseInput[]) {
  const map = new Map<string, Cents>();
  for (const expense of expenses) {
    map.set(expense.categoryName, (map.get(expense.categoryName) ?? 0) + expense.amountCents);
  }
  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  return entries.map(([category, amountCents]) => ({
    category,
    amountCents,
    sharePct: total > 0 ? Math.round((amountCents / total) * 100) : 0,
  }));
}

function buildWarnings(context: {
  month: MonthKey;
  netPositionCents: Cents;
  freeCashCents: Cents;
  plannedPersonalCents: Cents;
  actualPersonalCents: Cents;
  personalPlanStatus: "ok" | "near_limit" | "over";
  goals: GoalFeasibility[];
  projection: MonthlyAnalysis["projection"];
  medicalTotal: Cents;
  activePayments: FinancePaymentInput[];
  pawnedItems: PawnedItemInput[];
  loans: LoanInput[];
}): AnalysisWarning[] {
  const warnings: AnalysisWarning[] = [];

  if (context.netPositionCents < 0) {
    warnings.push({
      id: "shortfall",
      level: "danger",
      title: "This month is short",
      message: `You need ${formatShort(-context.netPositionCents)} more than your income covers. Record it as a loan or trim spending.`,
      actionLabel: "Record as loan",
      actionHref: `/analysis/shortfall?amount=${Math.round(-context.netPositionCents / 100)}`,
    });
  }

  if (context.personalPlanStatus === "over") {
    warnings.push({
      id: "personal-over",
      level: "warning",
      title: "Personal spending is over your plan",
      message: `You have spent ${formatShort(context.actualPersonalCents)} of a ${formatShort(context.plannedPersonalCents)} plan.`,
      actionLabel: "Review spending",
      actionHref: "/financial/personal-spending",
    });
  } else if (context.personalPlanStatus === "near_limit") {
    warnings.push({
      id: "personal-near",
      level: "info",
      title: "Personal spending is close to your plan",
      message: `You have used ${context.plannedPersonalCents > 0 ? Math.round((context.actualPersonalCents / context.plannedPersonalCents) * 100) : 0}% of this month's personal plan.`,
      actionLabel: "See spending",
      actionHref: "/financial/personal-spending",
    });
  }

  for (const goal of context.goals) {
    if (goal.reason === "free_cash_short") {
      warnings.push({
        id: `goal-${goal.goalId}`,
        level: "warning",
        title: `${goal.name} is not reachable this month`,
        message: goal.message,
        actionLabel: "Adjust goal",
        actionHref: "/goals",
      });
    }
  }

  if (context.projection.isShortfall) {
    warnings.push({
      id: "projection-shortfall",
      level: "info",
      title: "Next month looks tight",
      message: `Known bills and plans already exceed next month's income by ${formatShort(-context.projection.projectedNetCents)}.`,
      actionLabel: "See next month",
      actionHref: "/analysis",
    });
  }

  return warnings;
}

/** Build a loan from a recorded shortfall (BR-3). */
export function loanFromShortfall(shortfallCents: Cents, date = new Date()) {
  return {
    principalCents: Math.abs(shortfallCents),
    remainingBalanceCents: Math.abs(shortfallCents),
    interestRatePct: 0,
    method: "reducing" as const,
    startDate: date,
    sourceRef: "shortfall",
  };
}

export { requiredThisMonth, addDays };
