import { describe, expect, it } from "vitest";
import {
  buildMonthlyAnalysis,
  loanFromShortfall,
  loanMonthlyInterestCents,
  pawnMonthlyInterestCents,
  type AnalysisInput,
  type ExpenseInput,
  type GoalInput,
  type IncomeInput,
} from "@/lib/finance/analysis";
import { rupeesToCents } from "@/lib/money";

const MONTH = "2026-09";

function income(overrides: Partial<IncomeInput> = {}): IncomeInput {
  return {
    id: "inc-1",
    sourceName: "Salary",
    kind: "salary",
    amountCents: rupeesToCents(50_000),
    frequency: "monthly",
    date: new Date(2026, 8, 1),
    recurring: true,
    ...overrides,
  };
}

function expense(overrides: Partial<ExpenseInput> = {}): ExpenseInput {
  return {
    id: "exp-1",
    date: new Date(2026, 8, 2),
    amountCents: rupeesToCents(30_000),
    categoryName: "Other",
    recurring: false,
    isMedical: false,
    isPersonal: false,
    ...overrides,
  };
}

function goal(overrides: Partial<GoalInput> = {}): GoalInput {
  return {
    id: "goal-1",
    name: "Emergency fund",
    targetAmountCents: rupeesToCents(30_000),
    savedCents: 0,
    mode: "daily",
    dailyAmountCents: rupeesToCents(1_000),
    monthlyTargetCents: rupeesToCents(30_000),
    ...overrides,
  };
}

function baseInput(overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    month: MONTH,
    // Freeze "today" at the start of the month so day-dependent maths is stable.
    today: new Date(2026, 8, 1),
    incomes: [income()],
    expenses: [expense()],
    financePayments: [
      {
        id: "fp-1",
        lender: "Leasing",
        description: "Lease",
        amountCents: rupeesToCents(25_000),
        dueDayOfMonth: 5,
        monthsRemaining: 12,
        active: true,
      },
    ],
    loans: [],
    pawnedItems: [],
    goals: [],
    plannedPersonalCents: 0,
    ...overrides,
  };
}

describe("worked example from the specification", () => {
  // Income 50,000 + finance payments 25,000 + living expenses 30,000
  // -> total outflow 55,000 -> shortfall 5,000
  // -> a 30,000 savings goal is flagged unachievable.
  const analysis = buildMonthlyAnalysis(
    baseInput({ goals: [goal()], today: new Date(2026, 8, 30) }),
  );

  it("totals the outflow as living expenses + finance payments", () => {
    expect(analysis.income.totalCents).toBe(rupeesToCents(50_000));
    expect(analysis.outflow.livingExpensesCents).toBe(rupeesToCents(30_000));
    expect(analysis.outflow.financePaymentsCents).toBe(rupeesToCents(25_000));
    expect(analysis.outflow.totalCents).toBe(rupeesToCents(55_000));
  });

  it("reports a shortfall of 5,000 (BR-2)", () => {
    expect(analysis.netPositionCents).toBe(rupeesToCents(-5_000));
    expect(analysis.isShortfall).toBe(true);
  });

  it("flags the 30,000 savings goal as unachievable (BR-5)", () => {
    const target = analysis.goals.find((entry) => entry.goalId === "goal-1");
    expect(target).toBeDefined();
    expect(target?.achievable).toBe(false);
    expect(target?.reason).toBe("free_cash_short");
    expect(analysis.warnings.some((warning) => warning.id === "goal-goal-1")).toBe(true);
  });

  it("raises a shortfall warning with a call to action", () => {
    const shortfall = analysis.warnings.find((warning) => warning.id === "shortfall");
    expect(shortfall?.level).toBe("danger");
    expect(shortfall?.actionLabel).toBe("Record as loan");
  });
});

describe("BR-1 total outflow composition", () => {
  it("adds loan interest, pawn interest, planned personal spending and savings", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 30),
        loans: [
          {
            id: "loan-1",
            lender: "Bank",
            principalCents: rupeesToCents(100_000),
            interestRatePct: 12,
            method: "reducing",
            remainingBalanceCents: rupeesToCents(100_000),
            manualMonthlyInterestCents: null,
            dueDate: null,
          },
        ],
        pawnedItems: [
          {
            id: "pawn-1",
            description: "Gold chain",
            amountReceivedCents: rupeesToCents(50_000),
            interestRatePct: 0,
            monthlyInterestCents: rupeesToCents(2_000),
            nextInterestDueDate: new Date(2026, 8, 25),
            redemptionDate: null,
          },
        ],
        plannedPersonalCents: rupeesToCents(3_000),
        goals: [goal({ dailyAmountCents: rupeesToCents(1_000), monthlyTargetCents: rupeesToCents(30_000) })],
        expenses: [
          expense({ id: "e1", amountCents: rupeesToCents(20_000) }),
          expense({ id: "e2", amountCents: rupeesToCents(3_000), isPersonal: true }),
        ],
      }),
    );

    const expected =
      rupeesToCents(23_000) + // living expenses
      rupeesToCents(25_000) + // finance payments
      rupeesToCents(1_000) + // loan interest: 100,000 * 12% / 12
      rupeesToCents(3_000) + // planned personal spending (fully used)
      rupeesToCents(0); // savings: free cash is negative, so the goal is flagged, not budgeted

    expect(analysis.outflow.totalCents).toBe(expected);
    expect(analysis.goals[0].requiredThisMonthCents).toBe(rupeesToCents(1_000));
    expect(analysis.goals[0].plannedCents).toBe(0);
    expect(analysis.goals[0].achievable).toBe(false);
  });
});

describe("BR-2 shortfall", () => {
  it("is positive when income covers everything", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        expenses: [expense({ amountCents: rupeesToCents(10_000) })],
        today: new Date(2026, 8, 15),
      }),
    );
    expect(analysis.isShortfall).toBe(false);
    expect(analysis.netPositionCents).toBe(rupeesToCents(15_000));
  });
});

describe("BR-3 shortfall becomes a loan whose interest reduces future remaining money", () => {
  it("creates a loan with the shortfall as principal", () => {
    const loan = loanFromShortfall(rupeesToCents(-5_000), new Date(2026, 8, 30));
    expect(loan.principalCents).toBe(rupeesToCents(5_000));
    expect(loan.remainingBalanceCents).toBe(rupeesToCents(5_000));
    expect(loan.sourceRef).toBe("shortfall");
  });

  it("counts loan interest in a later month's outflow", () => {
    const withLoan = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 30),
        goals: [],
        loans: [
          {
            id: "loan-1",
            lender: "Family",
            principalCents: rupeesToCents(5_000),
            interestRatePct: 24,
            method: "reducing",
            remainingBalanceCents: rupeesToCents(5_000),
            manualMonthlyInterestCents: null,
            dueDate: null,
          },
        ],
      }),
    );

    expect(withLoan.outflow.loanInterestCents).toBe(rupeesToCents(100));
    expect(withLoan.netPositionCents).toBe(rupeesToCents(-5_100));
  });
});

describe("BR-4 daily savings target x days in month = monthly target", () => {
  it("scales a Rs. 1,000 daily target across the month", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 1),
        goals: [goal({ dailyAmountCents: rupeesToCents(1_000), monthlyTargetCents: rupeesToCents(30_000) })],
      }),
    );
    // 30 days in September 2026 -> 1,000 x 30 = 30,000.
    expect(analysis.goals[0].requiredThisMonthCents).toBe(rupeesToCents(30_000));
  });

  it("derives the daily figure from a monthly target", () => {
    const monthly = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 1),
        goals: [
          goal({ mode: "monthly", dailyAmountCents: rupeesToCents(1_000), monthlyTargetCents: rupeesToCents(20_000) }),
        ],
      }),
    );
    expect(monthly.goals[0].requiredThisMonthCents).toBe(rupeesToCents(20_000));
  });
});

describe("BR-5 unachievable goal", () => {
  it("is achievable when free cash covers the required contribution", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 1),
        expenses: [expense({ amountCents: rupeesToCents(10_000) })],
        goals: [goal({ dailyAmountCents: rupeesToCents(100), monthlyTargetCents: rupeesToCents(3_000) })],
      }),
    );
    expect(analysis.freeCashCents).toBe(rupeesToCents(15_000));
    expect(analysis.goals[0].achievable).toBe(true);
  });
});

describe("BR-6 next-month projection includes known obligations", () => {
  it("carries finance payments and pawn interest into next month", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 30),
        goals: [],
        pawnedItems: [
          {
            id: "pawn-1",
            description: "Gold chain",
            amountReceivedCents: rupeesToCents(50_000),
            interestRatePct: 0,
            monthlyInterestCents: rupeesToCents(2_000),
            nextInterestDueDate: new Date(2026, 9, 20),
            redemptionDate: null,
          },
        ],
      }),
    );

    expect(analysis.projection.month).toBe("2026-10");
    expect(analysis.projection.obligationsTotalCents).toBe(rupeesToCents(27_000));
    expect(analysis.projection.obligations.map((item) => item.key)).toContain("finance:fp-1");
    expect(analysis.projection.obligations.map((item) => item.key)).toContain("pawn:pawn-1");
  });

  it("drops finance payments that have run out", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 30),
        goals: [],
        financePayments: [
          {
            id: "fp-1",
            lender: "Leasing",
            description: "Lease",
            amountCents: rupeesToCents(25_000),
            dueDayOfMonth: 5,
            monthsRemaining: 0,
            active: true,
          },
        ],
      }),
    );
    expect(analysis.projection.obligationsTotalCents).toBe(0);
  });
});

describe("interest helpers", () => {
  it("prefers a manually recorded monthly interest", () => {
    expect(
      loanMonthlyInterestCents({
        id: "l",
        lender: "x",
        principalCents: rupeesToCents(100_000),
        interestRatePct: 12,
        method: "reducing",
        remainingBalanceCents: rupeesToCents(100_000),
        manualMonthlyInterestCents: rupeesToCents(750),
      }),
    ).toBe(rupeesToCents(750));
  });

  it("falls back to the annual rate divided by twelve", () => {
    expect(
      loanMonthlyInterestCents({
        id: "l",
        lender: "x",
        principalCents: rupeesToCents(120_000),
        interestRatePct: 12,
        method: "reducing",
        remainingBalanceCents: rupeesToCents(120_000),
        manualMonthlyInterestCents: null,
      }),
    ).toBe(rupeesToCents(1_200));
  });

  it("derives pawn interest from the annual rate when not recorded", () => {
    expect(
      pawnMonthlyInterestCents({
        id: "p",
        description: "Gold",
        amountReceivedCents: rupeesToCents(60_000),
        interestRatePct: 12,
        monthlyInterestCents: 0,
        nextInterestDueDate: null,
        redemptionDate: null,
      }),
    ).toBe(rupeesToCents(600));
  });
});

describe("income projection", () => {
  it("projects a monthly recurring source into a month with no dated entry", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 10),
        expenses: [],
        financePayments: [],
        goals: [],
        incomes: [income({ date: new Date(2026, 7, 25) })],
      }),
    );
    expect(analysis.income.totalCents).toBe(rupeesToCents(50_000));
  });

  it("excludes one-time income that happened in another month", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 10),
        expenses: [],
        financePayments: [],
        goals: [],
        incomes: [income({ frequency: "one_time", recurring: false, date: new Date(2026, 6, 3) })],
      }),
    );
    expect(analysis.income.totalCents).toBe(0);
  });
});

describe("personal spending plan (FR-7)", () => {
  it("warns at 80% and at 100% of the plan", () => {
    const at80 = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 10),
        financePayments: [],
        plannedPersonalCents: rupeesToCents(5_000),
        expenses: [expense({ isPersonal: true, amountCents: rupeesToCents(4_000) })],
      }),
    );
    expect(at80.personalPlanStatus).toBe("near_limit");
    expect(at80.personalPlanUsagePct).toBe(80);

    const over = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 10),
        financePayments: [],
        plannedPersonalCents: rupeesToCents(5_000),
        expenses: [expense({ isPersonal: true, amountCents: rupeesToCents(6_000) })],
      }),
    );
    expect(over.personalPlanStatus).toBe("over");
    expect(over.personalPlanRemainingCents).toBe(rupeesToCents(-1_000));
  });
});
