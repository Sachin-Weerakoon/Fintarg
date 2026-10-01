import { describe, expect, it } from "vitest";
import {
  allFeatures,
  can,
  canUpgrade,
  featuresOf,
  isEdition,
  mergeFeatures,
  PLAN_MATRIX,
  planLabel,
  planOf,
} from "@/lib/plans";

describe("planOf", () => {
  it("maps anything that is not business to basic", () => {
    expect(planOf("business")).toBe("business");
    expect(planOf("basic")).toBe("basic");
    expect(planOf("free")).toBe("basic");
    expect(planOf(null)).toBe("basic");
    expect(planOf(undefined)).toBe("basic");
    expect(planOf("nonsense")).toBe("basic");
  });
});

describe("can", () => {
  it("keeps Basic out of Business features (FR-14)", () => {
    expect(can("basic", "core.vault")).toBe(true);
    expect(can("basic", "business.advanced")).toBe(false);
    expect(can("basic", "business.companies")).toBe(false);
  });

  it("grants Business everything Basic has", () => {
    expect(can("business", "core.finance")).toBe(true);
    expect(can("business", "core.vault")).toBe(true);
    expect(can("business", "business.advanced")).toBe(true);
  });
});

describe("mergeFeatures", () => {
  it("returns the code default when there are no overrides", () => {
    expect(mergeFeatures("basic")).toEqual(PLAN_MATRIX.basic.features);
  });

  it("removes a feature an admin switched off (FR-15.1)", () => {
    const merged = mergeFeatures("basic", [{ feature: "core.vault", enabled: false }]);
    expect(merged).not.toContain("core.vault");
    expect(merged).toContain("core.finance");
  });

  it("can remove every feature for a plan", () => {
    const off = PLAN_MATRIX.business.features.map((feature) => ({ feature, enabled: false }));
    expect(mergeFeatures("business", off)).toEqual([]);
  });

  it("grants a feature the matrix did not include", () => {
    const merged = mergeFeatures("basic", [{ feature: "business.advanced", enabled: true }]);
    expect(merged).toContain("business.advanced");
  });

  it("ignores an unknown feature name rather than storing junk", () => {
    const merged = mergeFeatures("basic", [{ feature: "not.a.feature", enabled: true }]);
    expect(merged).not.toContain("not.a.feature");
    expect(merged).toEqual(PLAN_MATRIX.basic.features);
  });

  it("never mutates the shared matrix", () => {
    const before = [...PLAN_MATRIX.basic.features];
    mergeFeatures("basic", [{ feature: "core.vault", enabled: false }]);
    expect(PLAN_MATRIX.basic.features).toEqual(before);
  });

  it("lets the last row win for a repeated feature", () => {
    const merged = mergeFeatures("basic", [
      { feature: "core.vault", enabled: false },
      { feature: "core.vault", enabled: true },
    ]);
    expect(merged).toContain("core.vault");
  });
});

describe("featuresOf", () => {
  it("prefers the admin-resolved list over the code default", () => {
    const resolved = ["core.finance"] as const;
    expect(featuresOf("basic", [...resolved])).toEqual(["core.finance"]);
  });

  it("falls back to the matrix when nothing was resolved", () => {
    expect(featuresOf("basic", null)).toEqual(PLAN_MATRIX.basic.features);
  });
});

describe("planLabel and canUpgrade", () => {
  it("labels each edition", () => {
    expect(planLabel("basic")).toBe("Basic");
    expect(planLabel("business")).toBe("Business");
  });

  it("only offers an upgrade from Basic", () => {
    expect(canUpgrade("basic")).toBe(true);
    expect(canUpgrade("business")).toBe(false);
  });
});

describe("isEdition", () => {
  it("accepts only the two known editions", () => {
    expect(isEdition("basic")).toBe(true);
    expect(isEdition("business")).toBe(true);
    expect(isEdition("free")).toBe(false);
    expect(isEdition(null)).toBe(false);
    expect(isEdition(7)).toBe(false);
  });
});

describe("allFeatures", () => {
  it("lists every feature exactly once, with a label for the admin matrix", () => {
    const list = allFeatures();
    expect(new Set(list.map((row) => row.feature)).size).toBe(list.length);
    for (const row of list) {
      expect(row.label.length).toBeGreaterThan(0);
    }
  });

  it("includes features that only Business has, so an admin can grant them", () => {
    expect(allFeatures().map((row) => row.feature)).toContain("business.advanced");
  });
});