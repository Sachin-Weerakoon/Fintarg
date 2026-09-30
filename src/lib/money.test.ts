import { describe, expect, it } from "vitest";
import {
  centsToRupees,
  formatMoney,
  formatMoneyCompact,
  formatRupees,
  parseAmountToCents,
  percent,
  rupeesToCents,
  sum,
} from "@/lib/money";

describe("amount formatting", () => {
  it("always writes Rs. with thousand separators", () => {
    expect(formatRupees(50_000)).toBe("Rs. 50,000");
    expect(formatRupees(1_000_000)).toBe("Rs. 1,000,000");
    expect(formatRupees(0)).toBe("Rs. 0");
    expect(formatRupees(999)).toBe("Rs. 999");
  });

  it("keeps the minus sign next to the digits for negatives", () => {
    expect(formatRupees(-5_000)).toBe("Rs. -5,000");
    expect(formatRupees(5_000, { showSign: true })).toBe("Rs. +5,000");
  });

  it("shows decimals only when there really are paisa", () => {
    expect(formatMoney(rupeesToCents(50_000))).toBe("Rs. 50,000");
    expect(formatMoney(rupeesToCents(1_250.5))).toBe("Rs. 1,250.50");
    expect(formatMoney(rupeesToCents(-5_000))).toBe("Rs. -5,000");
  });

  it("compacts large numbers for dense lists", () => {
    expect(formatMoneyCompact(rupeesToCents(50_000))).toBe("Rs. 50k");
    expect(formatMoneyCompact(rupeesToCents(1_500_000))).toBe("Rs. 1.5M");
    expect(formatMoneyCompact(rupeesToCents(950))).toBe("Rs. 950");
  });
});

describe("parsing user input", () => {
  it("accepts the formats people actually type", () => {
    expect(parseAmountToCents("25000")).toBe(2_500_000);
    expect(parseAmountToCents("25,000")).toBe(2_500_000);
    expect(parseAmountToCents("Rs. 25,000")).toBe(2_500_000);
    expect(parseAmountToCents("25000.50")).toBe(2_500_050);
  });

  it("returns null for input it cannot read", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("-")).toBeNull();
  });

  it("keeps cents exact, with no floating point drift", () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point; cents must not care.
    const total = rupeesToCents(0.1) + rupeesToCents(0.2);
    expect(total).toBe(rupeesToCents(0.3));
    expect(centsToRupees(total)).toBeCloseTo(0.3, 10);
  });
});

describe("helpers", () => {
  it("sums and computes percentages", () => {
    expect(sum([100, 200, 300])).toBe(600);
    expect(percent(50, 200)).toBe(25);
    expect(percent(50, 0)).toBe(100);
  });
});
