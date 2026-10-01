import { describe, expect, it } from "vitest";
import {
  buildMonthlyAnalysis,
  loanFromShortfall,
  loanMonthlyInterestCents,
  pawnMonthlyInterestCents,
  paymentCountsInMonth,
  paymentsRemainingFrom,
  type AnalysisInput,
  type ExpenseInput,
  type FinancePaymentInput,
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
        startDate: new Date(2026, 6, 1),
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
            startDate: new Date(2026, 0, 1),
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
      rupeesToCents(20_000) + // living expenses (non-personal only - B1)
      rupeesToCents(25_000) + // finance payments
      rupeesToCents(1_000) + // loan interest: 100,000 * 12% / 12
      rupeesToCents(2_000) + // pawn interest: due 25 Sep, so it lands in September (B7)
      rupeesToCents(3_000) + // planned personal spending: max(3,000 plan, 3,000 spent)
      rupeesToCents(0); // savings: free cash is negative, so the goal is flagged, not budgeted

    expect(analysis.outflow.livingExpensesCents).toBe(rupeesToCents(20_000));
    expect(analysis.outflow.pawnInterestCents).toBe(rupeesToCents(2_000));
    expect(analysis.outflow.totalCents).toBe(expected);
    expect(analysis.goals[0].requiredThisMonthCents).toBe(rupeesToCents(1_000));
    expect(analysis.goals[0].plannedCents).toBe(0);
    expect(analysis.goals[0].achievable).toBe(false);

    // B7/B1: the printed lines must reconcile to the total, to the rupee.
    const breakdownTotal = analysis.outflow.breakdown.reduce((sum, line) => sum + line.amountCents, 0);
    expect(breakdownTotal).toBe(analysis.outflow.totalCents);
  });
});

describe("B1/B2 personal spending is never counted twice (D2)", () => {
  it("counts food plus personal spending against the plan once, not twice", () => {
    // Rs. 10,000 food + Rs. 4,000 personal against a Rs. 5,000 plan.
    // Living = 10,000, personal line = max(5,000, 4,000) = 5,000 -> 15,000 total,
    // never 10,000 + 4,000 + 5,000 = 19,000.
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 30),
        financePayments: [],
        goals: [],
        plannedPersonalCents: rupeesToCents(5_000),
        expenses: [
          expense({ id: "food", amountCents: rupeesToCents(10_000), isPersonal: false }),
          expense({ id: "fun", amountCents: rupeesToCents(4_000), isPersonal: true }),
        ],
      }),
    );

    expect(analysis.outflow.livingExpensesCents).toBe(rupeesToCents(10_000));
    expect(analysis.outflow.plannedPersonalCents).toBe(rupeesToCents(5_000));
    expect(analysis.outflow.totalCents).toBe(rupeesToCents(15_000));
    expect(analysis.totalSpentCents).toBe(rupeesToCents(14_000));
  });

  it("counts the plan even when nothing has been spent on it yet", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 30),
        financePayments: [],
        goals: [],
        plannedPersonalCents: rupeesToCents(5_000),
        expenses: [expense({ amountCents: rupeesToCents(10_000), isPersonal: false })],
      }),
    );
    expect(analysis.outflow.plannedPersonalCents).toBe(rupeesToCents(5_000));
    expect(analysis.outflow.totalCents).toBe(rupeesToCents(15_000));
  });

  it("uses the larger of plan and actual when spending overshoots", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 30),
        financePayments: [],
        goals: [],
        plannedPersonalCents: rupeesToCents(5_000),
        expenses: [
          expense({ id: "food", amountCents: rupeesToCents(10_000), isPersonal: false }),
          expense({ id: "fun", amountCents: rupeesToCents(6_000), isPersonal: true }),
        ],
      }),
    );
    expect(analysis.outflow.plannedPersonalCents).toBe(rupeesToCents(6_000));
    expect(analysis.outflow.totalCents).toBe(rupeesToCents(16_000));
    expect(analysis.personalPlanStatus).toBe("over");
  });
});

describe("D3 the four interest methods", () => {
  // Rs. 120,000 at 24% a year -> monthly rate 2%.
  const principal = rupeesToCents(120_000);
  const balance = rupeesToCents(100_000);
  const base = {
    id: "l",
    lender: "x",
    principalCents: principal,
    interestRatePct: 24,
    remainingBalanceCents: balance,
    manualMonthlyInterestCents: null,
    startDate: new Date(2026, 0, 1), // January, so September is month n = 9
    dueDate: null,
  } as const;

  it("reducing uses the remaining balance", () => {
    // 100,000 * 0.24 / 12 = 2,000
    expect(loanMonthlyInterestCents({ ...base, method: "reducing" }, MONTH)).toBe(rupeesToCents(2_000));
  });

  it("simple uses the original principal", () => {
    // 120,000 * 0.24 / 12 = 2,400
    expect(loanMonthlyInterestCents({ ...base, method: "simple" }, MONTH)).toBe(rupeesToCents(2_400));
  });

  it("flat uses the original principal", () => {
    expect(loanMonthlyInterestCents({ ...base, method: "flat" }, MONTH)).toBe(rupeesToCents(2_400));
  });

  it("compound compounds monthly from the start month", () => {
    // n = 9 (January is month 1, September is month 9), in integer cents.
    // P * ((1.02)^9 - (1.02)^8), P = 100,000 rupees = 10,000,000 cents.
    const expected = Math.round(rupeesToCents(100_000) * (Math.pow(1.02, 9) - Math.pow(1.02, 8)));
    // Rs. 2,343.32 on a Rs. 100,000 balance, i.e. slightly less than the
    // Rs. 2,400 that flat/simple would charge on the Rs. 120,000 principal.
    expect(expected).toBe(rupeesToCents(2_343.32));
    expect(loanMonthlyInterestCents({ ...base, method: "compound" }, MONTH)).toBe(expected);
  });

  it("gives four distinct values across the four methods", () => {
    const values = (["reducing", "simple", "flat", "compound"] as const).map((method) =>
      loanMonthlyInterestCents({ ...base, method }, MONTH),
    );
    // reducing, simple, flat, compound -> simple and flat coincide by definition,
    // so three distinct amounts, with compound different from the flat pair.
    expect(new Set(values).size).toBe(3);
    expect(values[2]).toBe(values[1]);
    expect(values[3]).not.toBe(values[1]);
  });

  it("returns nothing before the loan's start month", () => {
    const future = { ...base, startDate: new Date(2026, 10, 1) } as const; // starts in November
    expect(loanMonthlyInterestCents({ ...future, method: "reducing" }, MONTH)).toBe(0);
    expect(loanMonthlyInterestCents({ ...future, method: "compound" }, MONTH)).toBe(0);
  });

  it("stops accruing after the due month", () => {
    const finished = { ...base, dueDate: new Date(2026, 5, 30) } as const; // ended in June
    expect(loanMonthlyInterestCents({ ...finished, method: "reducing" }, MONTH)).toBe(0);
    expect(loanMonthlyInterestCents({ ...finished, method: "reducing" }, "2026-06")).toBeGreaterThan(0);
  });

  it("counts the start month itself (n = 1)", () => {
    const startsNow = { ...base, startDate: new Date(2026, 8, 15) } as const; // starts September
    // n = 1: exactly one month of interest, 100,000 * 2% = 2,000.
    expect(loanMonthlyInterestCents({ ...startsNow, method: "compound" }, MONTH)).toBe(
      rupeesToCents(2_000),
    );
    expect(loanMonthlyInterestCents({ ...startsNow, method: "reducing" }, MONTH)).toBe(
      rupeesToCents(2_000),
    );
  });
});

describe("B5 a finance payment only counts for the instalments it actually has", () => {
  const payment = (overrides: Partial<FinancePaymentInput> = {}): FinancePaymentInput => ({
    id: "fp-1",
    lender: "Leasing",
    description: "Lease",
    amountCents: rupeesToCents(25_000),
    dueDayOfMonth: 5,
    monthsRemaining: 3,
    startDate: new Date(2026, 8, 5), // first instalment September 2026
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

  it("drops out of the current month's total once the term is over", () => {
    const november = buildMonthlyAnalysis(
      baseInput({
        month: "2026-11",
        today: new Date(2026, 10, 1), // the 3rd and last instalment month
        goals: [],
        expenses: [],
        financePayments: [payment()],
      }),
    );
    expect(november.outflow.financePaymentsCents).toBe(rupeesToCents(25_000));

    const december = buildMonthlyAnalysis(
      baseInput({
        month: "2026-12",
        today: new Date(2026, 11, 1), // nothing left to pay
        goals: [],
        expenses: [],
        financePayments: [payment()],
      }),
    );
    expect(december.outflow.financePaymentsCents).toBe(0);
  });

  it("reports the instalments still to pay from today", () => {
    expect(paymentsRemainingFrom(payment(), new Date(2026, 8, 1))).toBe(3);
    expect(paymentsRemainingFrom(payment(), new Date(2026, 9, 1))).toBe(2);
    expect(paymentsRemainingFrom(payment(), new Date(2026, 11, 1))).toBe(0);
    expect(paymentsRemainingFrom(payment({ monthsRemaining: null }), new Date(2026, 8, 1))).toBeNull();
  });
});

describe("B6 a recurring income counts however long ago it was entered", () => {
  it("counts a salary recorded eight months ago", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 20),
        expenses: [],
        financePayments: [],
        goals: [],
        // January, recurring monthly - well outside the old 3-month window.
        incomes: [income({ date: new Date(2026, 0, 25) })],
      }),
    );
    expect(analysis.income.totalCents).toBe(rupeesToCents(50_000));
  });

  it("treats a monthly frequency as recurring even when the box was unticked", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 20),
        expenses: [],
        financePayments: [],
        goals: [],
        incomes: [income({ recurring: false, frequency: "monthly", date: new Date(2026, 0, 25) })],
      }),
    );
    expect(analysis.income.totalCents).toBe(rupeesToCents(50_000));
  });

  it("still ignores an old one-off income", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 20),
        expenses: [],
        financePayments: [],
        goals: [],
        incomes: [income({ recurring: false, frequency: "one_time", date: new Date(2026, 0, 25) })],
      }),
    );
    expect(analysis.income.totalCents).toBe(0);
  });
});

describe("B7 pawn interest lands in the breakdown and the total", () => {
  it("counts pawn interest only in the month it falls due", () => {
    const item = {
      id: "pawn-1",
      description: "Gold chain",
      amountReceivedCents: rupeesToCents(50_000),
      interestRatePct: 0,
      monthlyInterestCents: rupeesToCents(2_000),
      nextInterestDueDate: new Date(2026, 8, 25),
      redemptionDate: null,
    };

    const due = buildMonthlyAnalysis(
      baseInput({ today: new Date(2026, 8, 30), goals: [], expenses: [], financePayments: [], pawnedItems: [item] }),
    );
    expect(due.outflow.pawnInterestCents).toBe(rupeesToCents(2_000));
    expect(due.outflow.totalCents).toBe(rupeesToCents(2_000));
    expect(due.outflow.breakdown.find((line) => line.key === "pawn-interest")?.amountCents).toBe(
      rupeesToCents(2_000),
    );

    const notDue = buildMonthlyAnalysis(
      baseInput({
        month: "2026-10", // the 25 Sep date is in an earlier month
        today: new Date(2026, 9, 30),
        goals: [],
        expenses: [],
        financePayments: [],
        pawnedItems: [item],
      }),
    );
    expect(notDue.outflow.pawnInterestCents).toBe(0);
    expect(notDue.outflow.totalCents).toBe(0);
  });

  it("counts monthly when no due date is recorded", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 30),
        goals: [],
        expenses: [],
        financePayments: [],
        pawnedItems: [
          {
            id: "pawn-1",
            description: "Gold chain",
            amountReceivedCents: rupeesToCents(50_000),
            interestRatePct: 0,
            monthlyInterestCents: rupeesToCents(2_000),
            nextInterestDueDate: null,
            redemptionDate: null,
          },
        ],
      }),
    );
    expect(analysis.outflow.pawnInterestCents).toBe(rupeesToCents(2_000));
  });

  it("is not counted twice in the next-month projection", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 30),
        goals: [],
        expenses: [],
        financePayments: [],
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
    // October has its own interest date, and it appears exactly once as an
    // obligation. The projection adds it through obligationsTotal only.
    const pawnLines = analysis.projection.obligations.filter((item) => item.key === "pawn:pawn-1");
    expect(pawnLines).toHaveLength(1);
    expect(analysis.projection.obligationsTotalCents).toBe(rupeesToCents(2_000));
  });
});

describe("D6 what is left after the goals", () => {
  it("is 20,000 for 50,000 income against a 30,000 goal", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 1),
        expenses: [expense({ amountCents: rupeesToCents(10_000) })],
        goals: [goal({ dailyAmountCents: rupeesToCents(1_000), monthlyTargetCents: rupeesToCents(30_000) })],
      }),
    );
    // Income 50,000 less the goal's 30,000 monthly requirement.
    expect(analysis.leftAfterGoalsCents).toBe(rupeesToCents(20_000));
  });

  it("is a display figure only and does not change the shortfall", () => {
    const analysis = buildMonthlyAnalysis(
      baseInput({
        today: new Date(2026, 8, 1), // full month remaining, so the goal asks 30,000
        goals: [goal({ dailyAmountCents: rupeesToCents(1_000), monthlyTargetCents: rupeesToCents(30_000) })],
      }),
    );
    expect(analysis.leftAfterGoalsCents).toBe(rupeesToCents(20_000));
    // The worked example is unaffected: the goal is flagged, not budgeted.
    expect(analysis.netPositionCents).toBe(rupeesToCents(-5_000));
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
            startDate: new Date(2026, 0, 1),
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
            startDate: new Date(2026, 6, 1),
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
      loanMonthlyInterestCents(
        {
          id: "l",
          lender: "x",
          principalCents: rupeesToCents(100_000),
          interestRatePct: 12,
          method: "reducing",
          remainingBalanceCents: rupeesToCents(100_000),
          manualMonthlyInterestCents: rupeesToCents(750),
          startDate: new Date(2026, 0, 1),
        },
        MONTH,
      ),
    ).toBe(rupeesToCents(750));
  });

  it("falls back to the annual rate divided by twelve", () => {
    expect(
      loanMonthlyInterestCents(
        {
          id: "l",
          lender: "x",
          principalCents: rupeesToCents(120_000),
          interestRatePct: 12,
          method: "reducing",
          remainingBalanceCents: rupeesToCents(120_000),
          manualMonthlyInterestCents: null,
          startDate: new Date(2026, 0, 1),
        },
        MONTH,
      ),
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
