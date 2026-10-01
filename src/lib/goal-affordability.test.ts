import { describe, expect, it } from "vitest";
import { describeGoalAffordability } from "@/lib/goal-affordability";
import { rupeesToCents } from "@/lib/money";

const r = rupeesToCents;

describe("describeGoalAffordability", () => {
  it("reports what is left when the goals are comfortably fundable", () => {
    const result = describeGoalAffordability({
      incomeCents: r(53_000),
      goalsRequiredCents: r(10_000),
      goalCount: 2,
    });
    expect(result.leftAfterGoalsCents).toBe(r(43_000));
    expect(result.affordable).toBe(true);
    expect(result.tone).toBe("positive");
    // The figure has to appear in the sentence, not just in the data.
    expect(result.headline).toContain("Rs. 43,000");
  });

  it("flags a shortfall rather than budgeting an impossible saving", () => {
    const result = describeGoalAffordability({
      incomeCents: r(50_000),
      goalsRequiredCents: r(80_000),
      goalCount: 1,
    });
    expect(result.leftAfterGoalsCents).toBe(r(-30_000));
    expect(result.affordable).toBe(false);
    expect(result.tone).toBe("danger");
    // Says the shortfall plainly rather than hiding it behind a percentage.
    expect(result.headline).toContain("Rs. 80,000");
    expect(result.detail).toContain("Rs. 30,000");
    expect(result.detail).toContain("flagged");
  });

  it("warns, rather than celebrates, a goal set that uses every rupee", () => {
    const result = describeGoalAffordability({
      incomeCents: r(50_000),
      goalsRequiredCents: r(50_000),
      goalCount: 1,
    });
    expect(result.affordable).toBe(true);
    expect(result.tone).toBe("warning");
    expect(result.detail).toContain("nothing left");
  });

  it("uses the singular for one goal", () => {
    const result = describeGoalAffordability({
      incomeCents: r(50_000),
      goalsRequiredCents: r(5_000),
      goalCount: 1,
    });
    expect(result.headline).toContain("your goal");
    expect(result.headline).not.toContain("all 1 goals");
  });

  it("says nothing is being saved when there are no goals", () => {
    const result = describeGoalAffordability({
      incomeCents: r(50_000),
      goalsRequiredCents: 0,
      goalCount: 0,
    });
    expect(result.headline).toBe("Nothing is being saved this month");
    expect(result.affordable).toBe(false);
  });

  it("treats goals that need nothing as the same as no goals", () => {
    // A goal already fully funded must not claim Rs. 50,000 is "left over".
    const result = describeGoalAffordability({
      incomeCents: r(50_000),
      goalsRequiredCents: 0,
      goalCount: 3,
    });
    expect(result.headline).toBe("Nothing is being saved this month");
  });

  it("never claims affordability with no income", () => {
    const result = describeGoalAffordability({
      incomeCents: 0,
      goalsRequiredCents: r(1_000),
      goalCount: 1,
    });
    expect(result.affordable).toBe(false);
    expect(result.tone).toBe("danger");
  });
});