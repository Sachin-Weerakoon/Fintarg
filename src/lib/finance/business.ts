/**
 * Business finance engine.
 *
 * Pure functions that take plain business inputs and return a
 * `BusinessMonthAnalysis`. Nothing here touches the database.
 */

import { addMonths, monthRange, type MonthKey } from "@/lib/dates";
import type { Cents } from "@/lib/money";
import { loanMonthlyInterestCents, type LoanMethod } from "@/lib/finance/analysis";

export interface BusinessSaleInput {
  id: string;
  date: Date;
  amountCents: Cents;
  channel?: string | null;
  description?: string | null;
}

export interface BusinessCostInput {
  id: string;
  date: Date;
  amountCents: Cents;
  category: string;
  description?: string | null;
}

export interface BusinessPaymentInput {
  id: string;
  title: string;
  amountCents: Cents;
  frequency: string;
  dueDayOfMonth?: number | null;
  startDate: Date;
  monthsRemaining?: number | null;
  active: boolean;
}

export interface BusinessLoanInput {
  id: string;
  title: string;
  principalCents: Cents;
  interestRatePct: number;
  method: LoanMethod;
  remainingBalanceCents: Cents;
  manualMonthlyInterestCents?: number | null;
  startDate: Date;
  dueDate?: Date | null;
}

export interface OwnerDrawInput {
  id: string;
  amountCents: Cents;
  date: Date;
  notes?: string | null;
  reference?: string | null;
}

export interface BusinessTargetInput {
  id: string;
  name: string;
  targetAmountCents: Cents;
}

export interface BusinessMonthInput {
  month: MonthKey;
  today?: Date;
  sales: BusinessSaleInput[];
  costs: BusinessCostInput[];
  payments: BusinessPaymentInput[];
  loans: BusinessLoanInput[];
  ownerDraws: OwnerDrawInput[];
  targets: BusinessTargetInput[];
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

export interface TargetProgress {
  id: string;
  name: string;
  targetCents: Cents;
  achievedCents: Cents;
  remainingCents: Cents;
  pct: number;
}

export interface AnalysisWarning {
  id: string;
  level: "info" | "warning" | "danger";
  title: string;
  message: string;
}

export interface BusinessMonthAnalysis {
  month: MonthKey;
  revenue: {
    totalCents: Cents;
    byChannel: Record<string, Cents>;
    items: LineItem[];
  };
  costs: {
    totalCents: Cents;
    byCategory: Record<string, Cents>;
    items: LineItem[];
  };
  grossProfitCents: Cents;
  ownerDrawsCents: Cents;
  businessPaymentsCents: Cents;
  loanInterestCents: Cents;
  netProfitCents: Cents;
  obligations: ObligationItem[];
  targets: TargetProgress[];
  warnings: AnalysisWarning[];
}

function monthKeyToDate(month: MonthKey): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, (monthNumber ?? 1) - 1, 1);
}

function monthDistance(from: MonthKey, to: MonthKey): number {
  const a = monthKeyToDate(from);
  const b = monthKeyToDate(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function dueDateInMonth(dayOfMonth: number, month: MonthKey): Date {
  const base = monthRange(month).start;
  const maxDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return new Date(base.getFullYear(), base.getMonth(), Math.min(Math.max(1, dayOfMonth), maxDay));
}

export function paymentCountsInMonth(payment: BusinessPaymentInput, month: MonthKey): boolean {
  if (!payment.active) return false;
  const startMonth = `${payment.startDate.getFullYear()}-${String(payment.startDate.getMonth() + 1).padStart(2, "0")}`;
  const offset = monthDistance(startMonth, month);
  if (offset < 0) return false;
  if (payment.monthsRemaining == null) return true;
  return offset < payment.monthsRemaining;
}

export function buildBusinessMonthAnalysis(input: BusinessMonthInput): BusinessMonthAnalysis {
  const { month } = input;
  const today = input.today ?? new Date();
  const { start, end } = monthRange(month);

  /* ------------------------------------------------------------------ sales */
  const monthSales = input.sales.filter((sale) => sale.date >= start && sale.date <= end);
  const revenueTotal = monthSales.reduce((total, sale) => total + sale.amountCents, 0);
  const byChannel: Record<string, Cents> = {};
  for (const sale of monthSales) {
    const key = sale.channel?.trim() || "other";
    byChannel[key] = (byChannel[key] ?? 0) + sale.amountCents;
  }

  /* ------------------------------------------------------------------ costs */
  const monthCosts = input.costs.filter((cost) => cost.date >= start && cost.date <= end);
  const costsTotal = monthCosts.reduce((total, cost) => total + cost.amountCents, 0);
  const byCategory: Record<string, Cents> = {};
  for (const cost of monthCosts) {
    byCategory[cost.category] = (byCategory[cost.category] ?? 0) + cost.amountCents;
  }

  const grossProfit = revenueTotal - costsTotal;

  /* -------------------------------------------------------- owner draws */
  const monthDraws = input.ownerDraws.filter((draw) => draw.date >= start && draw.date <= end);
  const drawsTotal = monthDraws.reduce((total, draw) => total + draw.amountCents, 0);

  /* ------------------------------------------------- business payments */
  const duePayments = input.payments.filter((payment) => paymentCountsInMonth(payment, month));
  const paymentsTotal = duePayments.reduce((total, payment) => total + payment.amountCents, 0);

  /* ------------------------------------------------------- loan interest */
  const loanInterestTotal = input.loans.reduce(
    (total, loan) => total + loanMonthlyInterestCents(loan as any, month),
    0,
  );

  const netProfit = grossProfit - drawsTotal - paymentsTotal - loanInterestTotal;

  /* ------------------------------------------------------------- targets */
  const targetProgress: TargetProgress[] = input.targets.map((target) => {
    const achieved = Math.max(0, grossProfit);
    const remaining = Math.max(0, target.targetAmountCents - achieved);
    const pct = target.targetAmountCents > 0 ? Math.round((achieved / target.targetAmountCents) * 100) : 0;
    return {
      id: target.id,
      name: target.name,
      targetCents: target.targetAmountCents,
      achievedCents: achieved,
      remainingCents: remaining,
      pct: Math.min(100, pct),
    };
  });

  /* ------------------------------------------------------- obligations */
  const nextMonth = addMonths(monthKeyToDate(month), 1);
  const nextMonthKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

  const obligations: ObligationItem[] = duePayments
    .filter((payment) => paymentCountsInMonth(payment, nextMonthKey))
    .map((payment) => ({
      key: `payment:${payment.id}`,
      label: payment.title,
      amountCents: payment.amountCents,
      dueDay: payment.dueDayOfMonth ?? undefined,
      dueDate: payment.dueDayOfMonth ? dueDateInMonth(payment.dueDayOfMonth, nextMonthKey) : undefined,
      detail: payment.frequency,
    }));

  const projectionLoans: ObligationItem[] = input.loans
    .map((loan) => ({ loan, interest: loanMonthlyInterestCents(loan as any, nextMonthKey) }))
    .filter((entry) => entry.interest > 0)
    .map(({ loan, interest }) => ({
      key: `loan:${loan.id}`,
      label: `${loan.title} interest`,
      amountCents: interest,
      detail: loan.method,
    }));

  obligations.push(...projectionLoans);

  /* ----------------------------------------------------------------- warnings */
  const warnings: AnalysisWarning[] = [];
  if (netProfit < 0) {
    warnings.push({
      id: "business-shortfall",
      level: "danger",
      title: "This month is a loss",
      message: `Revenue minus costs and obligations leaves a shortfall of Rs. ${Math.round(Math.abs(netProfit) / 100).toLocaleString("en-LK")}.`,
    });
  }
  if (drawsTotal > grossProfit) {
    warnings.push({
      id: "draws-exceed-profit",
      level: "warning",
      title: "Owner draws exceed profit",
      message: "You have taken more out of the business than it earned this month.",
    });
  }
  for (const target of targetProgress) {
    if (target.pct < 100 && target.achievedCents > 0) {
      warnings.push({
        id: `target-${target.id}`,
        level: "info",
        title: `${target.name} is ${target.pct}% of target`,
        message: `Rs. ${Math.round(target.achievedCents / 100).toLocaleString("en-LK")} of Rs. ${Math.round(target.targetCents / 100).toLocaleString("en-LK")}.`,
      });
    }
  }

  return {
    month,
    revenue: {
      totalCents: revenueTotal,
      byChannel,
      items: monthSales.map((sale) => ({
        key: sale.id,
        label: sale.description || sale.channel || "Sale",
        amountCents: sale.amountCents,
        detail: sale.channel || undefined,
        href: undefined,
      })),
    },
    costs: {
      totalCents: costsTotal,
      byCategory,
      items: monthCosts.map((cost) => ({
        key: cost.id,
        label: cost.description || cost.category,
        amountCents: cost.amountCents,
        detail: cost.category,
        href: undefined,
      })),
    },
    grossProfitCents: grossProfit,
    ownerDrawsCents: drawsTotal,
    businessPaymentsCents: paymentsTotal,
    loanInterestCents: loanInterestTotal,
    netProfitCents: netProfit,
    obligations,
    targets: targetProgress,
    warnings,
  };
}
