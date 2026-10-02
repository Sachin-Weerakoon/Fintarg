import { prisma } from "@/lib/db";
import {
  buildBusinessMonthAnalysis,
  type BusinessCostInput,
  type BusinessLoanInput,
  type BusinessMonthInput,
  type BusinessMonthAnalysis,
  type BusinessPaymentInput,
  type BusinessSaleInput,
  type BusinessTargetInput,
  type OwnerDrawInput,
} from "@/lib/finance/business";
import { monthRange, type MonthKey } from "@/lib/dates";

export interface BusinessAnalysisBundle {
  analysis: BusinessMonthAnalysis;
  raw: {
    sales: BusinessSaleInput[];
    costs: BusinessCostInput[];
    payments: BusinessPaymentInput[];
    loans: BusinessLoanInput[];
    ownerDraws: OwnerDrawInput[];
    targets: BusinessTargetInput[];
  };
}

export async function loadBusinessMonthAnalysis(
  userId: string,
  businessId: string,
  month: MonthKey,
  options: { today?: Date } = {},
): Promise<BusinessAnalysisBundle> {
  const { start, end } = monthRange(month);

  const [sales, costs, payments, loans, draws, targets] = await Promise.all([
    prisma.businessSale.findMany({
      where: { userId, businessId, deletedAt: null, date: { gte: start, lte: end } },
      orderBy: { date: "desc" },
    }),
    prisma.businessCost.findMany({
      where: { userId, businessId, deletedAt: null, date: { gte: start, lte: end } },
      orderBy: { date: "desc" },
    }),
    prisma.businessPayment.findMany({
      where: { userId, businessId, deletedAt: null, active: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.businessLoan.findMany({
      where: { userId, businessId, deletedAt: null },
      orderBy: { startDate: "desc" },
    }),
    prisma.ownerDraw.findMany({
      where: { userId, businessId, deletedAt: null, date: { gte: start, lte: end } },
      orderBy: { date: "desc" },
    }),
    prisma.businessTarget.findMany({
      where: { userId, businessId, deletedAt: null },
      orderBy: { month: "desc" },
    }),
  ]);

  const mappedSales: BusinessSaleInput[] = sales.map((sale) => ({
    id: sale.id,
    date: sale.date,
    amountCents: sale.amountCents,
    channel: sale.channel,
    description: sale.description,
  }));

  const mappedCosts: BusinessCostInput[] = costs.map((cost) => ({
    id: cost.id,
    date: cost.date,
    amountCents: cost.amountCents,
    category: cost.category,
    description: cost.description,
  }));

  const mappedPayments: BusinessPaymentInput[] = payments.map((payment) => ({
    id: payment.id,
    title: payment.title,
    amountCents: payment.amountCents,
    frequency: payment.frequency,
    dueDayOfMonth: payment.dueDayOfMonth,
    startDate: payment.startDate,
    monthsRemaining: payment.monthsRemaining,
    active: payment.active,
  }));

  const mappedLoans: BusinessLoanInput[] = loans.map((loan) => ({
    id: loan.id,
    title: loan.title,
    principalCents: loan.principalCents,
    interestRatePct: loan.interestRatePct,
    method: loan.method as BusinessLoanInput["method"],
    remainingBalanceCents: loan.remainingBalanceCents,
    manualMonthlyInterestCents: loan.manualMonthlyInterestCents,
    startDate: loan.startDate,
    dueDate: loan.dueDate,
  }));

  const mappedDraws: OwnerDrawInput[] = draws.map((draw) => ({
    id: draw.id,
    amountCents: draw.amountCents,
    date: draw.date,
    notes: draw.notes,
    reference: draw.reference,
  }));

  const mappedTargets: BusinessTargetInput[] = targets.map((target) => ({
    id: target.id,
    name: target.name,
    targetAmountCents: target.targetAmountCents,
  }));

  const input: BusinessMonthInput = {
    month,
    today: options.today,
    sales: mappedSales,
    costs: mappedCosts,
    payments: mappedPayments,
    loans: mappedLoans,
    ownerDraws: mappedDraws,
    targets: mappedTargets,
  };

  return {
    analysis: buildBusinessMonthAnalysis(input),
    raw: {
      sales: mappedSales,
      costs: mappedCosts,
      payments: mappedPayments,
      loans: mappedLoans,
      ownerDraws: mappedDraws,
      targets: mappedTargets,
    },
  };
}
