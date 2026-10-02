import { describe, it, expect } from "vitest";
import {
  isMode,
  hasPersonalLedger,
  hasBusinessLedger,
  defaultPlanForMode,
  defaultWorkspaceForMode,
  USER_MODES,
  MODE_LABEL,
  MODE_DESCRIPTION,
} from "@/lib/mode";

describe("mode helpers", () => {
  it("USER_MODES has exactly three values", () => {
    expect(USER_MODES).toEqual(["salary", "business", "both"]);
  });

  it("isMode identifies valid modes", () => {
    expect(isMode("salary")).toBe(true);
    expect(isMode("business")).toBe(true);
    expect(isMode("both")).toBe(true);
    expect(isMode("invalid")).toBe(false);
    expect(isMode(null)).toBe(false);
    expect(isMode(123)).toBe(false);
  });

  it("hasPersonalLedger is true for salary and both", () => {
    expect(hasPersonalLedger("salary")).toBe(true);
    expect(hasPersonalLedger("both")).toBe(true);
    expect(hasPersonalLedger("business")).toBe(false);
  });

  it("hasBusinessLedger is true for business and both", () => {
    expect(hasBusinessLedger("business")).toBe(true);
    expect(hasBusinessLedger("both")).toBe(true);
    expect(hasBusinessLedger("salary")).toBe(false);
  });

  it("defaultPlanForMode returns basic for all modes", () => {
    expect(defaultPlanForMode("salary")).toBe("basic");
    expect(defaultPlanForMode("business")).toBe("basic");
    expect(defaultPlanForMode("both")).toBe("basic");
  });

  it("defaultWorkspaceForMode returns correct object shapes", () => {
    expect(defaultWorkspaceForMode("salary")).toEqual({ kind: "personal" });
    expect(defaultWorkspaceForMode("business")).toEqual({ kind: "allBusinesses" });
    expect(defaultWorkspaceForMode("both")).toEqual({ kind: "combined" });
  });

  it("MODE_LABEL has entries for all modes", () => {
    expect(MODE_LABEL.salary).toBe("Salary");
    expect(MODE_LABEL.business).toBe("Business");
    expect(MODE_LABEL.both).toBe("Both");
  });

  it("MODE_DESCRIPTION has entries for all modes", () => {
    expect(MODE_DESCRIPTION.salary).toContain("Personal");
    expect(MODE_DESCRIPTION.business).toContain("Business");
    expect(MODE_DESCRIPTION.both).toContain("owner draws");
  });
});