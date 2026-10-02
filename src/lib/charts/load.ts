import { loadAnalysis } from "@/lib/finance/load";
import { formatMonthLabel, type MonthKey } from "@/lib/dates";
import type { TrendPoint } from "@/lib/charts/geometry";

/**
 * Builds the money trend series for the chart.
 *
 * Calls the same `loadAnalysis` the dashboard uses, one call per month, so a month
 * in the chart is computed by exactly the same arithmetic as that month on its own
 * screen. Months with no records at all are skipped rather than plotted as zero -
 * a flat zero line would read as "you spent nothing", which is a different claim.
 *
 * Every query is scoped to `userId` (BR-8).
 */
export async function loadMoneyTrend(
  userId: string,
  options: { months?: number; endMonth?: MonthKey } = {},
): Promise<TrendPoint[]> {
  const months = Math.min(Math.max(options.months ?? 6, 1), 24);
  const endMonth = options.endMonth ?? currentMonthOrProvided();

  const keys: MonthKey[] = [];
  for (let back = months - 1; back >= 0; back -= 1) {
    keys.push(shiftMonth(endMonth, -back));
  }

  const points: TrendPoint[] = [];
  for (const month of keys) {
    const { analysis, raw } = await loadAnalysis(userId, month);
    // Nothing recorded for the month: leave a gap rather than implying a real zero.
    if (raw.incomes.length === 0 && raw.expenses.length === 0) continue;

    points.push({
      month,
      label: formatMonthLabel(month).replace(/ \d{4}$/, ""),
      incomeCents: analysis.income.totalCents,
      outflowCents: analysis.outflow.totalCents,
      netCents: analysis.netPositionCents,
    });
  }

  return points;
}

function currentMonthOrProvided(): MonthKey {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}