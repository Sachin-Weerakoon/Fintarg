import { formatMoney } from "@/lib/money";
import {
  areaPath,
  buildTrendScale,
  describeTrend,
  polylineString,
  slotX,
  toPathPoints,
  type TrendPoint,
} from "@/lib/charts/geometry";
import { cn } from "@/lib/cn";

/**
 * Money trend chart: money in against money out, month by month, hand-written SVG.
 *
 * No charting dependency is added. Accessibility is handled three ways, because a
 * canvas or a bare `<svg>` is useless to some screen readers:
 *   1. the SVG is `role="img"` with a sentence-long `aria-label` built from the data;
 *   2. a real `<table>` of the same numbers sits in a `sr-only` block, so a screen
 *      reader can actually read the figures;
 *   3. colour is never the only signal - every month is labelled and the legend
 *      names both series in words.
 *
 * A shortfall is drawn *below* the zero line, which is the entire reason this chart
 * exists: the dashboard's headline number is for one month, and this shows the trend.
 */
export function MoneyTrendChart({
  points,
  height = 200,
  className,
}: {
  points: TrendPoint[];
  height?: number;
  className?: string;
}) {
  if (points.length === 0) return null;

  // Fixed internal coordinate system; the SVG scales to its container.
  const WIDTH = 600;
  const PLOT_HEIGHT = 150;
  const AXIS_HEIGHT = 22;
  const totalHeight = PLOT_HEIGHT + AXIS_HEIGHT;

  const scale = buildTrendScale(points);
  const xs = (index: number) => slotX(index, points.length, WIDTH);

  const incomePoints = toPathPoints(points, (p) => p.incomeCents, scale, xs);
  const outflowPoints = toPathPoints(points, (p) => p.outflowCents, scale, xs);

  // Net is drawn as bars from the zero line, because a signed area is hard to read.
  const barWidth = Math.max(4, (WIDTH / points.length) * 0.22);

  const summary = describeTrend(points);

  return (
    <figure className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${totalHeight}`}
        className="h-auto w-full"
        role="img"
        aria-label={summary}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Gridlines, labelled in rupees so the scale is readable. */}
        {[0, 0.5, 1].map((fraction) => {
          const value = scale.max - (scale.max - scale.min) * fraction;
          const y = PLOT_HEIGHT * fraction;
          return (
            <g key={fraction}>
              <line
                x1={0}
                x2={WIDTH}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
              <text
                x={2}
                y={Math.max(10, y - 3)}
                className="fill-current text-[10px] text-text-muted"
                fontSize={9}
              >
                {formatMoney(Math.round(value))}
              </text>
            </g>
          );
        })}

        {/* The zero line: everything below it is a shortfall. */}
        {scale.zeroY < 1 ? (
          <>
            <line
              x1={0}
              x2={WIDTH}
              y1={PLOT_HEIGHT * scale.zeroY}
              y2={PLOT_HEIGHT * scale.zeroY}
              stroke="currentColor"
              className="text-text-muted"
              strokeWidth={1.5}
            />
            <text
              x={WIDTH - 2}
              y={PLOT_HEIGHT * scale.zeroY - 4}
              textAnchor="end"
              className="fill-current text-[9px] text-text-muted"
              fontSize={9}
            >
              break-even
            </text>
          </>
        ) : null}

        {/* Outflow first, so income sits on top where they overlap. */}
        <path d={areaPath(outflowPoints, PLOT_HEIGHT * scale.zeroY)} className="fill-danger/15" />
        <path d={areaPath(incomePoints, PLOT_HEIGHT * scale.zeroY)} className="fill-positive/15" />
        <polyline
          points={polylineString(outflowPoints)}
          fill="none"
          className="stroke-danger"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <polyline
          points={polylineString(incomePoints)}
          fill="none"
          className="stroke-positive"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Net bars, signed around the zero line. */}
        {points.map((point, index) => {
          const y = PLOT_HEIGHT * scale.y(point.netCents);
          const zero = PLOT_HEIGHT * scale.zeroY;
          const top = Math.min(y, zero);
          const barHeight = Math.max(1.5, Math.abs(zero - y));
          return (
            <rect
              key={point.month}
              x={xs(index) - barWidth / 2}
              y={top}
              width={barWidth}
              height={barHeight}
              rx={1.5}
              className={point.netCents < 0 ? "fill-danger" : "fill-accent"}
              opacity={0.85}
            >
              <title>
                {point.label}: {formatMoney(point.incomeCents)} in, {formatMoney(point.outflowCents)} out,{" "}
                {point.netCents < 0
                  ? `shortfall ${formatMoney(Math.abs(point.netCents))}`
                  : `surplus ${formatMoney(point.netCents)}`}
              </title>
            </rect>
          );
        })}

        {/* X axis labels, thinned so they never overlap on a narrow screen. */}
        {points.map((point, index) => {
          const step = Math.ceil(points.length / 6);
          if (index % step !== 0 && index !== points.length - 1) return null;
          return (
            <text
              key={point.month}
              x={xs(index)}
              y={PLOT_HEIGHT + 14}
              textAnchor="middle"
              className="fill-current text-[10px] text-text-muted"
              fontSize={9}
            >
              {point.label}
            </text>
          );
        })}
      </svg>

      {/* The same numbers, readable by a screen reader or printed. */}
      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Money in</th>
            <th scope="col">Money out</th>
            <th scope="col">Left or short</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.month}>
              <th scope="row">{point.label}</th>
              <td>{formatMoney(point.incomeCents)}</td>
              <td>{formatMoney(point.outflowCents)}</td>
              <td>
                {point.netCents < 0
                  ? `Short ${formatMoney(Math.abs(point.netCents))}`
                  : `Left ${formatMoney(point.netCents)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend: names both series and the bars in words. */}
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-muted">
        <LegendKey className="bg-positive" label="Money in" />
        <LegendKey className="bg-danger" label="Money out" />
        <LegendKey className="bg-accent" label="Month left over (bar below the line = short)" />
      </figcaption>
    </figure>
  );
}

function LegendKey({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("h-2.5 w-2.5 rounded-pill", className)} />
      {label}
    </span>
  );
}