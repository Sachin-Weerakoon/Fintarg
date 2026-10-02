import { type Cents } from "@/lib/money";
import { formatMoney } from "@/lib/money";

/**
 * Chart geometry, kept pure and separate from the rendering so it can be unit
 * tested. No chart library is used (the project has no runtime dependencies for
 * this and must not add one); these are the few numbers a hand-written SVG needs.
 */

export interface TrendPoint {
  /** "YYYY-MM". */
  month: string;
  /** Short label for the x axis, e.g. "Oct". */
  label: string;
  incomeCents: Cents;
  outflowCents: Cents;
  /** Signed: positive surplus, negative shortfall. */
  netCents: Cents;
}

export interface ChartScale {
  min: Cents;
  max: Cents;
  /** Fraction of the chart height where `value` sits, 0 = top, 1 = bottom. */
  y: (value: Cents) => number;
  /**
   * A "nice" ceiling for the axis. Rounded up so the top gridline is a round
   * figure rather than an arbitrary maximum.
   */
  niceMax: Cents;
  zeroY: number;
}

function niceCeiling(value: Cents): Cents {
  if (value <= 0) return 0;
  // Round up to 1, 2 or 5 x a power of ten, so gridlines read as round rupees.
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Build the vertical scale for a money trend chart.
 *
 * `min` is always at or below zero, because the whole point of the chart is to
 * show a shortfall *below* the line. A month with no data at all still gets a
 * usable scale.
 */
export function buildTrendScale(
  points: TrendPoint[],
  options: { paddingTop?: number; paddingBottom?: number } = {},
): ChartScale {
  const padTop = options.paddingTop ?? 0.08;
  const padBottom = options.paddingBottom ?? 0.12;

  const values = points.flatMap((point) => [point.incomeCents, point.outflowCents, point.netCents]);
  const dataMax = values.length > 0 ? Math.max(...values, 0) : 0;
  const dataMin = values.length > 0 ? Math.min(...values, 0) : 0;

  // Always show zero, and always a little headroom above the tallest bar.
  const top = niceCeiling(dataMax * (1 + padTop));
  const bottom = dataMin < 0 ? -niceCeiling(-dataMin * (1 + padTop)) : 0;

  const span = top - bottom || 1;
  return {
    min: bottom,
    max: top,
    niceMax: top,
    zeroY: (top - 0) / span,
    y: (value: Cents) => (top - value) / span,
  };
}

/** Points for a line/area path. `x(i)` maps an index to a horizontal position. */
export function toPathPoints(
  points: TrendPoint[],
  pick: (point: TrendPoint) => Cents,
  scale: ChartScale,
  x: (index: number) => number,
): { x: number; y: number }[] {
  return points.map((point, index) => ({ x: x(index), y: scale.y(pick(point)) }));
}

/** A polyline `points` attribute string, e.g. "0,10 50,4". */
export function polylineString(points: { x: number; y: number }[]): string {
  return points.map((point) => `${round(point.x)},${round(point.y)}`).join(" ");
}

/** An area path closed down to the zero line, for the fill under a series. */
export function areaPath(
  points: { x: number; y: number }[],
  zeroY: number,
): string {
  if (points.length === 0) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return [
    `M ${round(first.x)},${round(zeroY)}`,
    ...points.map((point) => `L ${round(point.x)},${round(point.y)}`),
    `L ${round(last.x)},${round(zeroY)}`,
    "Z",
  ].join(" ");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Evenly spaced x positions across `count` slots, leaving a half-slot inset so the
 * first and last bars are not clipped at the edges.
 */
export function slotX(index: number, count: number, width: number): number {
  if (count <= 1) return width / 2;
  const slot = width / count;
  return slot * index + slot / 2;
}

/**
 * Human summary of a series, used as the chart's accessible name.
 *
 * Written out in words with real amounts, so a screen-reader user learns the same
 * thing a sighted user reads off the bars.
 */
export function describeTrend(points: TrendPoint[]): string {
  if (points.length === 0) return "No months of data yet.";

  const last = points[points.length - 1];
  const best = points.reduce((winner, point) => (point.netCents > winner.netCents ? point : winner));
  const worst = points.reduce((lowest, point) => (point.netCents < lowest.netCents ? point : lowest));

  const verdict = (point: TrendPoint) =>
    point.netCents < 0
      ? `a shortfall of ${formatMoney(Math.abs(point.netCents))}`
      : `a surplus of ${formatMoney(point.netCents)}`;

  const parts = [
    `Money in against money out over ${points.length} month${points.length === 1 ? "" : "s"}.`,
    `Best month ${best.label} with ${verdict(best)}.`,
  ];
  if (worst !== best) {
    parts.push(`Worst month ${worst.label} with ${verdict(worst)}.`);
  }
  parts.push(`Most recent month ${last.label} with ${verdict(last)}.`);
  return parts.join(" ");
}