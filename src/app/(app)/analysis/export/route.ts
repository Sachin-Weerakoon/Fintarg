import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loadAnalysis } from "@/lib/finance/load";
import { currentMonthKey, formatDate } from "@/lib/dates";
import { renderAnalysisPdf } from "@/lib/pdf/analysis";
import { ensureReadableOnWhite } from "@/lib/theme";

/** FR-5: optional PDF export of the monthly analysis. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const month = new URL(request.url).searchParams.get("month") ?? currentMonthKey();
  const { analysis } = await loadAnalysis(user.id, month, { today: new Date() });

  const buffer = await renderAnalysisPdf({
    analysis,
    edition: user.edition,
    userName: user.fullName ?? user.email,
    todayLabel: formatDate(new Date()),
    accentHex: ensureReadableOnWhite(user.themeAccent),
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fintarg-analysis-${month}.pdf"`,
      "Cache-Control": "no-store, private",
    },
  });
}
