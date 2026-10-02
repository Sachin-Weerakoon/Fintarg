import { describe, expect, it } from "vitest";
import {
  buildBusinessMonthAnalysis,
  paymentCountsInMonth,
  type BusinessCostInput,
  type BusinessLoanInput,
  type BusinessMonthInput,
  type BusinessPaymentInput,
  type BusinessSaleInput,
  type OwnerDrawInput,
  type BusinessTargetInput,
} from "@/lib/finance/business";
import { rupeesToCents } from "@/lib/money";

const MONTH = "2026-09";

function sale(overrides: Partial<BusinessSaleInput> = {}): BusinessSaleInput {
  return {
    id: "sale-1",
    date: new Date(2026, 8, 5),
    amountCents: rupeesToCents(100_000),
    channel: "cash",
    description: "Product sale",
    ...overrides,
  };
}

function cost(overrides: Partial<BusinessCostInput> = {}): BusinessCostInput {
  return {
    id: "cost-1",
    date: new Date(2026, 8, 5),
    amountCents: rupeesToCents(40_000),
    category: "stock",
    description: "Inventory",
    ...overrides,
  };
}

function businessPayment(overrides: Partial<BusinessPaymentInput> = {}): BusinessPaymentInput {
  return {
    id: "bp-1",
    title: "Shop rent",
    amountCents: rupeesToCents(15_000),
    frequency: "monthly",
    dueDayOfMonth: 5,
    startDate: new Date(2026, 8, 1),
    monthsRemaining: 12,
    active: true,
    ...overrides,
  };
}

function businessLoan(overrides: Partial<BusinessLoanInput> = {}): BusinessLoanInput {
  return {
    id: "bl-1",
    title: "Business loan",
    principalCents: rupeesToCents(200_000),
    interestRatePct: 12,
    method: "reducing",
    remainingBalanceCents: rupeesToCents(200_000),
    manualMonthlyInterestCents: null,
    startDate: new Date(2026, 0, 1),
    dueDate: null,
    ...overrides,
  };
}

function ownerDraw(overrides: Partial<OwnerDrawInput> = {}): OwnerDrawInput {
  return {
    id: "od-1",
    amountCents: rupeesToCents(10_000),
    date: new Date(2026, 8, 10),
    notes: null,
    reference: null,
    ...overrides,
  };
}

function businessTarget(overrides: Partial<BusinessTargetInput> = {}): BusinessTargetInput {
  return {
    id: "bt-1",
    name: "Monthly revenue target",
    targetAmountCents: rupeesToCents(120_000),
    ...overrides,
  };
}

function baseInput(overrides: Partial<BusinessMonthInput> = {}): BusinessMonthInput {
  return {
    month: MONTH,
    today: new Date(2026, 8, 15),
    sales: [sale()],
    costs: [cost()],
    payments: [businessPayment()],
    loans: [businessLoan()],
    ownerDraws: [ownerDraw()],
    targets: [businessTarget()],
    ...overrides,
  };
}

describe("business month analysis", () => {
  it("computes revenue, costs, and gross profit", () => {
    const analysis = buildBusinessMonthAnalysis(
      baseInput({
        payments: [],
        loans: [],
        ownerDraws: [],
        targets: [],
      }),
    );

    expect(analysis.revenue.totalCents).toBe(rupeesToCents(100_000));
    expect(analysis.costs.totalCents).toBe(rupeesToCents(40_000));
    expect(analysis.grossProfitCents).toBe(rupeesToCents(60_000));
  });

  it("deducts owner draws, payments and loan interest to reach net profit", () => {
    const analysis = buildBusinessMonthAnalysis(
      baseInput({
        targets: [],
      }),
    );

    // revenue 100,000 - costs 40,000 - draws 10,000 - payments 15,000 - loan interest 2,000 = 33,000
    expect(analysis.ownerDrawsCents).toBe(rupeesToCents(10_000));
    expect(analysis.businessPaymentsCents).toBe(rupeesToCents(15_000));
    expect(analysis.loanInterestCents).toBe(rupeesToCents(2_000));
    expect(analysis.netProfitCents).toBe(rupeesToCents(33_000));
  });

  it("raises a loss warning when net profit is negative", () => {
    const analysis = buildBusinessMonthAnalysis(
      baseInput({
        sales: [sale({ amountCents: rupeesToCents(20_000) })],
        targets: [],
      }),
    );

    const warning = analysis.warnings.find((w) => w.id === "business-shortfall");
    expect(warning).toBeDefined();
    expect(warning?.level).toBe("danger");
  });

  it("warns when owner draws exceed gross profit", () => {
    const analysis = buildBusinessMonthAnalysis(
      baseInput({
        sales: [sale({ amountCents: rupeesToCents(30_000) })],
        ownerDraws: [ownerDraw({ amountCents: rupeesToCents(40_000) })],
        targets: [],
      }),
    );

    const warning = analysis.warnings.find((w) => w.id === "draws-exceed-profit");
    expect(warning).toBeDefined();
    expect(warning?.level).toBe("warning");
  });

  it("tracks target progress against gross profit", () => {
    const analysis = buildBusinessMonthAnalysis(
      baseInput({
        payments: [],
        loans: [],
        ownerDraws: [],
        targets: [businessTarget({ targetAmountCents: rupeesToCents(60_000) })],
      }),
    );

    const target = analysis.targets[0];
    expect(target.achievedCents).toBe(rupeesToCents(60_000));
    expect(target.pct).toBe(100);
  });

  it("reports payment obligations for next month", () => {
    const analysis = buildBusinessMonthAnalysis(
      baseInput({
        loans: [],
        ownerDraws: [],
        targets: [],
      }),
    );

    const paymentObligation = analysis.obligations.find((o) => o.key === "payment:bp-1");
    expect(paymentObligation).toBeDefined();
    expect(paymentObligation?.amountCents).toBe(rupeesToCents(15_000));
  });
});

describe("business payment month filtering", () => {
  const payment = (overrides: Partial<BusinessPaymentInput> = {}): BusinessPaymentInput => ({
    id: "bp-1",
    title: "Rent",
    amountCents: rupeesToCents(15_000),
    frequency: "monthly",
    dueDayOfMonth: 5,
    startDate: new Date(2026, 8, 1),
    monthsRemaining: 3,
    active: true,
    ...overrides,
  });

  it("counts exactly three months when monthsRemaining is 3", () => {
    const months = ["2026-09", "2026-10", "2026-11", "2026-12"];
    const counted = months.filter((month) => paymentCountsInMonth(payment(), month));
    expect(counted).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  it("does not count before the start month", () => {
    expect(paymentCountsInMonth(payment(), "2026-08")).toBe(false);
    expect(paymentCountsInMonth(payment(), "2026-09")).toBe(true);
  });

  it("never ends when monthsRemaining is null", () => {
    expect(paymentCountsInMonth(payment({ monthsRemaining: null }), "2035-01")).toBe(true);
  });

  it("is inactive when active is false", () => {
    expect(paymentCountsInMonth(payment({ active: false }), "2026-09")).toBe(false);
  });
});
