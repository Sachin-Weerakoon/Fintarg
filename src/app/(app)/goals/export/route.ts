import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { currentMonthKey, formatDate } from "@/lib/dates";
import { loadAnalysis } from "@/lib/finance/load";
import { renderGoalsPdf } from "@/lib/pdf/goals";
import { ensureReadableOnWhite } from "@/lib/theme";
import { requireFeature } from "@/lib/guard";

export const dynamic = "force-dynamic";

/**
 * Savings goals report PDF (Phase 3 export).
 *
 * Scoped to `userId` (BR-8) and gated on the goals feature, so the route cannot
 * serve a report to an account whose plan has goals switched off.
 */
export async function GET(request: Request) {
  const user = await requireFeature("core.goals");

  const month = new URL(request.url).searchParams.get("month") ?? currentMonthKey();
  const [{ analysis }, goals] = await Promise.all([
    loadAnalysis(user.id, month, { today: new Date() }),
    prisma.savingsGoal.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      include: { contributions: true },
    }),
  ]);

  const buffer = await renderGoalsPdf({
    month,
    edition: user.edition,
    userName: user.displayName,
    todayLabel: formatDate(new Date()),
    accentHex: ensureReadableOnWhite(user.themeAccent),
    incomeCents: analysis.income.totalCents,
    savedTotalCents: goals.reduce(
      (total, goal) => total + goal.contributions.reduce((sum, c) => sum + c.amountCents, 0),
      0,
    ),
    goals: goals.map((goal) => {
      const feasibility = analysis.goals.find((item) => item.goalId === goal.id);
      const saved = goal.contributions.reduce((sum, c) => sum + c.amountCents, 0);
      return {
        name: goal.name,
        note: goal.note,
        targetCents: goal.targetAmountCents,
        savedCents: saved,
        dailyCents: goal.dailyAmountCents,
        monthlyCents: goal.monthlyTargetCents,
        endDate: goal.endDate,
        achievable: feasibility?.achievable ?? true,
        message: feasibility?.message ?? "",
      };
    }),
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fintarg-goals-${month}.pdf"`,
      "Cache-Control": "no-store, private",
    },
  });
}