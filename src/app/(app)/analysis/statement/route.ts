import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { currentMonthKey, formatDate, monthRange } from "@/lib/dates";
import { renderStatementPdf, type StatementLine } from "@/lib/pdf/statement";
import { loadAnalysis } from "@/lib/finance/load";
import { ensureReadableOnWhite } from "@/lib/theme";

export const dynamic = "force-dynamic";

/**
 * Money statement PDF (Phase 3 export).
 *
 * Every query is scoped to `userId` (BR-8), so one account can never download
 * another's statement by changing the `month` parameter.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const month = new URL(request.url).searchParams.get("month") ?? currentMonthKey();
  const { start, end } = monthRange(month);

  const [{ analysis }, incomes, expenses] = await Promise.all([
    loadAnalysis(user.id, month, { today: new Date() }),
    prisma.income.findMany({
      where: { userId: user.id, deletedAt: null, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
    prisma.expense.findMany({
      where: { userId: user.id, deletedAt: null, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
  ]);

  const lines: StatementLine[] = [
    ...incomes.map((row) => ({
      date: row.date,
      description: row.sourceName,
      category: row.kind === "recurring" ? "Regular income" : "One-off income",
      signedCents: row.amountCents,
    })),
    ...expenses.map((row) => ({
      date: row.date,
      description: row.note?.trim() || row.categoryName || "Expense",
      category: row.categoryName || "Uncategorised",
      signedCents: -row.amountCents,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const buffer = await renderStatementPdf({
    month,
    edition: user.edition,
    userName: user.displayName,
    todayLabel: formatDate(new Date()),
    accentHex: ensureReadableOnWhite(user.themeAccent),
    analysisNetCents: analysis.netPositionCents,
    analysisIncomeCents: analysis.income.totalCents,
    analysisOutflowCents: analysis.outflow.totalCents,
    lines,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fintarg-statement-${month}.pdf"`,
      "Cache-Control": "no-store, private",
    },
  });
}