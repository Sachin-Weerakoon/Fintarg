import PDFKit from "pdfkit";
import { formatMoney } from "@/lib/money";
import { formatMonthLabel } from "@/lib/dates";
import type { MonthlyAnalysis } from "@/lib/finance/analysis";
import type { Edition } from "@/lib/plans";

/**
 * PDF export of the monthly analysis (FR-5, optional in the spec but shipped
 * because the export is the artefact people take to a bank or a family member).
 *
 * Rendered with pdfkit on the server; the download route is the only entry point.
 */
export async function renderAnalysisPdf(input: {
  analysis: MonthlyAnalysis;
  edition: Edition;
  userName: string;
  todayLabel: string;
  accentHex: string;
}): Promise<Buffer> {
  const { analysis, userName, todayLabel } = input;
  // pdfkit is listed in `serverExternalPackages`, so it stays a Node-only
  // dependency and never reaches the browser bundle.
  const doc = new PDFKit({ size: "A4", margin: 48, bufferPages: true });

  // pdfkit writes asynchronously, so the buffer can only be assembled once the
  // document stream has actually finished.
  const finished = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  const money = (cents: number) => formatMoney(cents);

  /* ------------------------------------------------------------------ head */
  doc.fillColor(input.accentHex).fontSize(11).font("Helvetica-Bold").text("FINTARG");
  doc
    .fillColor("#0f1b2f")
    .fontSize(20)
    .font("Helvetica-Bold")
    .text("Monthly money analysis", { lineGap: 4 });
  doc
    .fillColor("#546680")
    .fontSize(10)
    .font("Helvetica")
    .text(`${formatMonthLabel(analysis.month)} · ${userName} · prepared ${todayLabel}`);
  doc.moveDown(1.2);

  /* --------------------------------------------------------- net position */
  const shortfall = analysis.netPositionCents < 0;
  doc
    .roundedRect(left, doc.y, width, 74, 8)
    .fillAndStroke("#f7f9fc", shortfall ? "#b91c1c" : "#047857");
  doc
    .fillColor("#0f1b2f")
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("NET POSITION THIS MONTH", left + 16, doc.y + 14);
  doc
    .fillColor(shortfall ? "#b91c1c" : "#047857")
    .fontSize(22)
    .font("Helvetica-Bold")
    .text(
      `${shortfall ? "Shortfall " : "Remaining "}${formatMoney(Math.abs(analysis.netPositionCents)).replace("Rs. ", "Rs. ")}`,
      left + 16,
      doc.y + 28,
    );
  doc.y += 74;
  doc.moveDown(1.2);

  /* -------------------------------------------------------------- money in */
  sectionTitle(doc, "Money in", left, right);
  row(doc, "Income this month", money(analysis.income.totalCents), left, right, { bold: true });
  for (const item of analysis.income.items) {
    row(doc, `   ${item.label}${item.detail ? ` (${item.detail})` : ""}`, money(item.amountCents), left, right);
  }
  doc.moveDown(0.6);

  /* ------------------------------------------------------------ money out */
  sectionTitle(doc, "Money out", left, right);
  row(doc, "Living expenses", money(analysis.outflow.livingExpensesCents), left, right);
  row(doc, "Finance payments", money(analysis.outflow.financePaymentsCents), left, right);
  row(doc, "Loan interest", money(analysis.outflow.loanInterestCents), left, right);
  if (analysis.outflow.pawnInterestCents > 0) {
    row(doc, "Pawn interest", money(analysis.outflow.pawnInterestCents), left, right);
  }
  row(doc, "Planned personal spending", money(analysis.outflow.plannedPersonalCents), left, right);
  row(doc, "Savings", money(analysis.outflow.savingsCents), left, right);
  row(doc, "Total out", money(analysis.outflow.totalCents), left, right, { bold: true, rule: true });
  doc.moveDown(0.6);

  /* ------------------------------------------------------------------ goals */
  if (analysis.goals.length > 0) {
    sectionTitle(doc, "Savings goals", left, right);
    for (const goal of analysis.goals) {
      const status = goal.reason === "already_saved" ? "Reached" : goal.achievable ? "On track" : "Not possible yet";
      row(
        doc,
        `${goal.name} — saved ${money(goal.savedCents)} of ${money(goal.targetCents)} (${status})`,
        money(Math.max(0, goal.targetCents - goal.savedCents)),
        left,
        right,
      );
      doc
        .fillColor(goal.achievable ? "#546680" : "#b45309")
        .fontSize(8.5)
        .font("Helvetica")
        .text(goal.message, left + 8, doc.y + 1, { width: width - 8 });
      doc.moveDown(0.25);
    }
    doc.moveDown(0.4);
  }

  /* -------------------------------------------------------------- next month */
  sectionTitle(doc, `Next month (${formatMonthLabel(analysis.projection.month)})`, left, right);
  row(doc, "Expected income", money(analysis.projection.incomeCents), left, right);
  for (const obligation of analysis.projection.obligations) {
    row(doc, `   ${obligation.label}`, money(obligation.amountCents), left, right);
  }
  row(doc, "Expected living costs", money(analysis.projection.projectedExpensesCents), left, right);
  row(
    doc,
    analysis.projection.isShortfall ? "Expected shortfall" : "Expected remaining money",
    money(analysis.projection.projectedNetCents),
    left,
    right,
    { bold: true, rule: true, tone: analysis.projection.isShortfall ? "danger" : "positive" },
  );

  /* --------------------------------------------------------------- warnings */
  if (analysis.warnings.length > 0) {
    doc.moveDown(1);
    sectionTitle(doc, "What needs your attention", left, right);
    for (const warning of analysis.warnings) {
      doc
        .fillColor(warning.level === "danger" ? "#b91c1c" : warning.level === "warning" ? "#b45309" : "#1d4ed8")
        .fontSize(9.5)
        .font("Helvetica-Bold")
        .text(`• ${warning.title}`, left, doc.y, { width });
      doc
        .fillColor("#0f1b2f")
        .fontSize(9)
        .font("Helvetica")
        .text(`  ${warning.message}`, left + 10, doc.y, { width: width - 10 });
      doc.moveDown(0.35);
    }
  }

  /* ------------------------------------------------------------ category mix */
  if (analysis.categoryTotals.length > 0) {
    doc.moveDown(0.8);
    sectionTitle(doc, "Where the money went", left, right);
    for (const category of analysis.categoryTotals) {
      row(
        doc,
        `${category.category} (${category.sharePct}%)`,
        money(category.amountCents),
        left,
        right,
      );
    }
  }

  const footer = (page: number) => {
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#546680")
      .text(
        `Fintarg · ${input.edition === "business" ? "Business" : "Basic"} plan · private document · page ${page}`,
        left,
        doc.page.height - 42,
        { width, align: "center" },
      );
  };

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    footer(i - range.start + 1);
  }

  doc.end();
  return finished;
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string, left: number, right: number) {
  doc.moveDown(0.4);
  doc
    .fillColor("#0f1b2f")
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(text, left, doc.y);
  const y = doc.y + 2;
  doc
    .moveTo(left, y)
    .lineTo(right, y)
    .lineWidth(0.8)
    .strokeColor("#dde5ef")
    .stroke();
  doc.moveDown(0.5);
}

function row(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  left: number,
  right: number,
  options: { bold?: boolean; rule?: boolean; tone?: "danger" | "positive" } = {},
) {
  const y = doc.y;
  const font = options.bold ? ("Helvetica-Bold" as const) : ("Helvetica" as const);
  doc.fontSize(options.bold ? 10.5 : 9.5).font(font).fillColor("#0f1b2f");
  doc.text(label, left, y, { width: right - left - 110 });
  doc.text(value, left, y, { width: right - left, align: "right" });
  if (options.tone === "danger") doc.fillColor("#b91c1c");
  else if (options.tone === "positive") doc.fillColor("#047857");
  if (options.rule) {
    const lineY = doc.y + 2;
    doc.moveTo(left, lineY).lineTo(right, lineY).lineWidth(0.6).strokeColor("#dde5ef").stroke();
    doc.moveDown(0.35);
  }
}
