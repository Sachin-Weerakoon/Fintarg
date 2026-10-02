import { describe, it, expect } from "vitest";
import {
  workspaceFromCookie,
  workspaceToCookie,
  type WorkspaceKind,
} from "@/lib/mode";

describe("workspace cookie parsing", () => {
  const salaryIds = ["biz1", "biz2"];
  const businessIds = ["biz1", "biz2"];
  const bothIds = ["biz1", "biz2"];

  it("no cookie returns default for mode", () => {
    expect(workspaceFromCookie(undefined, "salary", salaryIds)).toEqual({ kind: "personal" });
    expect(workspaceFromCookie(undefined, "business", businessIds)).toEqual({ kind: "allBusinesses" });
    expect(workspaceFromCookie(undefined, "both", bothIds)).toEqual({ kind: "combined" });
  });

  it("personal cookie works for salary and both modes", () => {
    expect(workspaceFromCookie("personal", "salary", salaryIds)).toEqual({ kind: "personal" });
    expect(workspaceFromCookie("personal", "both", bothIds)).toEqual({ kind: "personal" });
  });

  it("personal cookie falls back for business mode", () => {
    expect(workspaceFromCookie("personal", "business", businessIds)).toEqual({ kind: "allBusinesses" });
  });

  it("combined cookie works for both mode", () => {
    expect(workspaceFromCookie("combined", "both", bothIds)).toEqual({ kind: "combined" });
  });

  it("combined cookie falls back for salary and business modes", () => {
    expect(workspaceFromCookie("combined", "salary", salaryIds)).toEqual({ kind: "personal" });
    expect(workspaceFromCookie("combined", "business", businessIds)).toEqual({ kind: "allBusinesses" });
  });

  it("allBusinesses cookie works for business and both modes", () => {
    expect(workspaceFromCookie("allBusinesses", "business", businessIds)).toEqual({ kind: "allBusinesses" });
    expect(workspaceFromCookie("allBusinesses", "both", bothIds)).toEqual({ kind: "allBusinesses" });
  });

  it("allBusinesses cookie falls back for salary mode", () => {
    expect(workspaceFromCookie("allBusinesses", "salary", salaryIds)).toEqual({ kind: "personal" });
  });

  it("business-specific cookie works for business and both modes when id matches", () => {
    expect(workspaceFromCookie("b:biz1", "business", businessIds)).toEqual({ kind: "business", businessId: "biz1" });
    expect(workspaceFromCookie("b:biz2", "both", bothIds)).toEqual({ kind: "business", businessId: "biz2" });
  });

  it("business-specific cookie falls back when id does not match", () => {
    expect(workspaceFromCookie("b:unknown", "business", businessIds)).toEqual({ kind: "allBusinesses" });
    expect(workspaceFromCookie("b:unknown", "both", bothIds)).toEqual({ kind: "combined" });
  });

  it("business-specific cookie falls back for salary mode", () => {
    expect(workspaceFromCookie("b:biz1", "salary", salaryIds)).toEqual({ kind: "personal" });
  });

  it("unknown cookie falls back to default", () => {
    expect(workspaceFromCookie("garbage", "salary", salaryIds)).toEqual({ kind: "personal" });
    expect(workspaceFromCookie("garbage", "business", businessIds)).toEqual({ kind: "allBusinesses" });
    expect(workspaceFromCookie("garbage", "both", bothIds)).toEqual({ kind: "combined" });
  });

  it("workspaceToCookie serializes correctly", () => {
    expect(workspaceToCookie({ kind: "personal" })).toBe("personal");
    expect(workspaceToCookie({ kind: "combined" })).toBe("combined");
    expect(workspaceToCookie({ kind: "allBusinesses" })).toBe("allBusinesses");
    expect(workspaceToCookie({ kind: "business", businessId: "abc123" })).toBe("b:abc123");
  });

  it("round-trip: cookie -> workspace -> cookie", () => {
    const cookie = "b:test123";
    const ws = workspaceFromCookie(cookie, "both", ["test123", "other"]);
    expect(ws).toEqual({ kind: "business", businessId: "test123" });
    expect(workspaceToCookie(ws)).toBe(cookie);
  });

  it("empty business ids array falls back correctly", () => {
    expect(workspaceFromCookie("b:biz1", "business", [])).toEqual({ kind: "allBusinesses" });
    expect(workspaceFromCookie("b:biz1", "both", [])).toEqual({ kind: "combined" });
  });
});