import { describe, expect, it } from "vitest";
import {
  areaPath,
  buildTrendScale,
  describeTrend,
  polylineString,
  slotX,
  toPathPoints,
  type TrendPoint,
} from "@/lib/charts/geometry";
import { rupeesToCents } from "@/lib/money";

const r = rupeesToCents;

const POINTS: TrendPoint[] = [
  { month: "2026-07", label: "Jul", incomeCents: r(50_000), outflowCents: r(55_000), netCents: r(-5_000) },
  { month: "2026-08", label: "Aug", incomeCents: r(52_000), outflowCents: r(48_000), netCents: r(4_000) },
  { month: "2026-09", label: "Sep", incomeCents: r(53_000), outflowCents: r(58_000), netCents: r(-5_000) },
];

describe("buildTrendScale", () => {
  it("always includes zero, so a shortfall is visible below the line", () => {
    const scale = buildTrendScale(POINTS);
    expect(scale.min).toBeLessThanOrEqual(0);
    expect(scale.max).toBeGreaterThan(0);
  });

  it("extends below zero when a month is short", () => {
    const scale = buildTrendScale(POINTS);
    expect(scale.min).toBeLessThan(0);
    // The shortest bar must land inside the plot area, not off the bottom.
    expect(scale.y(scale.min)).toBe(1);
  });

  it("puts zero at the bottom when nothing is ever negative", () => {
    const scale = buildTrendScale([
      { month: "2026-01", label: "Jan", incomeCents: r(10_000), outflowCents: r(5_000), netCents: r(5_000) },
    ]);
    expect(scale.min).toBe(0);
    // y is "fraction down the chart", so with a floor of zero the zero line is
    // the bottom edge.
    expect(scale.zeroY).toBe(1);
    expect(scale.y(0)).toBe(1);
    expect(scale.y(scale.max)).toBe(0);
  });

  it("puts zero in the middle when there are months on both sides", () => {
    const scale = buildTrendScale(POINTS);
    expect(scale.zeroY).toBeGreaterThan(0);
    expect(scale.zeroY).toBeLessThan(1);
    expect(scale.y(0)).toBeCloseTo(scale.zeroY, 6);
  });

  it("rounds the top gridline up to a round figure", () => {
    const scale = buildTrendScale([
      { month: "2026-01", label: "Jan", incomeCents: r(53_317), outflowCents: r(1), netCents: r(0) },
    ]);
    // A ceiling of 60,000 or 100,000, never the raw 53,317.
    expect(scale.niceMax % 10_000_00).toBe(0);
    expect(scale.niceMax).toBeGreaterThanOrEqual(r(53_317));
  });

  it("survives no data at all", () => {
    const scale = buildTrendScale([]);
    expect(Number.isFinite(scale.max)).toBe(true);
    expect(scale.max).toBeGreaterThanOrEqual(0);
  });

  it("places larger values higher up the chart (smaller y)", () => {
    const scale = buildTrendScale(POINTS);
    expect(scale.y(r(50_000))).toBeLessThan(scale.y(r(10_000)));
  });
});

describe("slotX", () => {
  it("spaces slots evenly and insets the first and last", () => {
    const xs = [0, 1, 2].map((index) => slotX(index, 3, 300));
    expect(xs).toEqual([50, 150, 250]);
  });

  it("centres a single point instead of dividing by zero", () => {
    expect(slotX(0, 1, 300)).toBe(150);
  });
});

describe("toPathPoints and polylineString", () => {
  const scale = buildTrendScale(POINTS);
  const xs = [0, 1, 2].map((index) => slotX(index, 3, 300));

  it("maps every point to an x and a y", () => {
    const path = toPathPoints(POINTS, (point) => point.netCents, scale, (index) => xs[index]);
    expect(path).toHaveLength(3);
    expect(path[0].x).toBe(50);
  });

  it("joins the points into a polyline string", () => {
    const path = toPathPoints(POINTS, (point) => point.netCents, scale, (index) => xs[index]);
    const polyline = polylineString(path);
    expect(polyline.split(" ")).toHaveLength(3);
    expect(polyline).toMatch(/^50,[\d.]+ 150,[\d.]+ 250,[\d.]+$/);
  });

  it("returns an empty area path for no points", () => {
    expect(areaPath([], 10)).toBe("");
  });

  it("closes an area down to the zero line", () => {
    const path = areaPath([{ x: 0, y: 5 }, { x: 10, y: 2 }], 20);
    expect(path.startsWith("M 0,20")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    expect(path).toContain("L 10,20");
  });
});

describe("describeTrend", () => {
  it("says so when there is nothing to plot", () => {
    expect(describeTrend([])).toBe("No months of data yet.");
  });

  it("names the best and worst months in words with real amounts", () => {
    const text = describeTrend(POINTS);
    expect(text).toContain("3 months");
    expect(text).toContain("Best month Aug");
    expect(text).toContain("Worst month Jul");
    expect(text).toContain("shortfall of Rs. 5,000");
    expect(text).toContain("surplus of Rs. 4,000");
  });

  it("does not repeat the same month as best and worst", () => {
    const allPositive = [POINTS[1]];
    const text = describeTrend(allPositive);
    expect(text).not.toContain("Worst month");
  });
});