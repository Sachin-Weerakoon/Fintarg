import { formatMoney } from "@/lib/money";
import { formatDate, formatMonthLabel } from "@/lib/dates";
import {
  beginDocument,
  callout,
  documentHead,
  layout,
  note,
  row,
  sectionTitle,
  stampFooters,
  tableHead,
} from "./parts";
import type { Edition } from "@/lib/plans";

export interface StatementLine {
  date: Date;
  description: string;
  category: string;
  /** Positive for money in, negative for money out. */
  signedCents: number;
}

export interface StatementInput {
  userName: string;
  todayLabel: string;
  month: string;
  edition: Edition;
  accentHex: string;
  /**
   * The headline figure Fintarg's own analysis reports, which applies the BR-1
   * rules (recurring expansion, loan and pawn interest, planned personal spend).
   */
  analysisNetCents: number;
  analysisIncomeCents: number;
  analysisOutflowCents: number;
  lines: StatementLine[];
}

const COLUMNS = {
  date: 74,
  description: 210,
  category: 110,
  amount: 80,
};

/**
 * Month statement: every transaction actually recorded for one month, in date order.
 *
 * The totals in this document are the **plain sums of the listed rows**, so the
 * document always adds up when a reader checks it. They are deliberately not the
 * BR-1 analysis totals, which expand recurring items and add loan and pawn interest;
 * that figure is printed separately with the difference explained, rather than
 * quietly substituting one for the other.
 */
export async function renderStatementPdf(input: StatementInput): Promise<Buffer> {
  const { doc, finished } = beginDocument();
  const page = layout(doc);
  const money = (cents: number) => formatMoney(cents);

  const recordedIn = input.lines
    .filter((line) => line.signedCents > 0)
    .reduce((total, line) => total + line.signedCents, 0);
  const recordedOut = -input.lines
    .filter((line) => line.signedCents < 0)
    .reduce((total, line) => total + line.signedCents, 0);
  const recordedNet = recordedIn - recordedOut;
  const short = recordedNet < 0;

  documentHead(page, {
    accentHex: input.accentHex,
    title: "Money statement",
    subtitle: `${formatMonthLabel(input.month)} · ${input.userName} · prepared ${input.todayLabel}`,
  });

  /* ---------------------------------------------------------------- headline */
  callout(page, {
    title: short ? "Short on what you recorded" : "Left on what you recorded",
    value: money(Math.abs(recordedNet)),
    caption: `${recordedIn === 0 ? "Nothing in" : money(recordedIn)} in and ${money(
      recordedOut,
    )} out, across ${input.lines.length} recorded ${input.lines.length === 1 ? "line" : "lines"}.`,
    tone: short ? "danger" : "positive",
  });

  row(doc, "Recorded money in", money(recordedIn), page.left, page.right);
  row(doc, "Recorded money out", money(recordedOut), page.left, page.right);
  row(doc, short ? "Recorded shortfall" : "Recorded remaining", money(recordedNet), page.left, page.right, {
    bold: true,
    rule: true,
    tone: short ? "danger" : "positive",
  });
  doc.moveDown(0.4);

  /* ---------------------------------------------------- Fintarg's own figure */
  sectionTitle(doc, "The figure Fintarg reports for this month", page.left, page.right);
  row(doc, "Money in (with recurring brought in)", money(input.analysisIncomeCents), page.left, page.right);
  row(doc, "Money out (with interest and planned spending)", money(input.analysisOutflowCents), page.left, page.right);
  row(
    doc,
    input.analysisNetCents < 0 ? "Shortfall" : "Remaining",
    money(input.analysisNetCents),
    page.left,
    page.right,
    { bold: true, rule: true, tone: input.analysisNetCents < 0 ? "danger" : "positive" },
  );
  const difference = input.analysisNetCents - recordedNet;
  if (difference !== 0) {
    note(
      doc,
      `This is ${money(Math.abs(difference))} ${difference > 0 ? "more" : "less"} than the recorded lines above. ` +
        "That is expected, and it is the most important thing to understand on this page: the lines are only the " +
        "rows you have entered, whereas this figure also counts your fixed finance payments falling due in the " +
        "month, recurring income and expenses you have not entered a row for yet, loan and pawn interest, and your " +
        "planned personal spending. The recorded lines alone will usually look better than the real month.",
      page.left,
      page.width,
    );
  }
  doc.moveDown(0.4);

  /* ------------------------------------------------------------- transaction */
  sectionTitle(doc, "Everything recorded this month", page.left, page.right);

  if (input.lines.length === 0) {
    note(doc, "No income or expenses were recorded for this month.", page.left, page.width);
  } else {
    const header = () =>
      tableHead(page, [
        { label: "Date", width: COLUMNS.date },
        { label: "Details", width: COLUMNS.description },
        { label: "Category", width: COLUMNS.category },
        { label: "Amount", width: COLUMNS.amount, align: "right" },
      ]);

    header();

    for (const line of input.lines) {
      // Keep a row with its header rather than orphaning it at a page break.
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        sectionTitle(doc, "Everything recorded this month (continued)", page.left, page.right);
        header();
      }

      const y = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor("#0f1b2f");
      doc.text(formatDate(line.date), page.left, y, { width: COLUMNS.date });
      doc.text(line.description, page.left + COLUMNS.date, y, { width: COLUMNS.description });
      doc.fillColor("#546680").text(line.category, page.left + COLUMNS.date + COLUMNS.description, y, {
        width: COLUMNS.category,
      });
      doc
        .fillColor(line.signedCents < 0 ? "#b91c1c" : "#047857")
        .text(
          line.signedCents < 0 ? `-${money(Math.abs(line.signedCents))}` : money(line.signedCents),
          page.left + COLUMNS.date + COLUMNS.description + COLUMNS.category,
          y,
          { width: COLUMNS.amount, align: "right" },
        );
      doc.y = y + 13;
      doc.fillColor("#0f1b2f");
    }

    // Must reconcile to the callout above.
    doc.moveDown(0.4);
    row(doc, `Sum of the ${input.lines.length} lines above`, money(recordedNet), page.left, page.right, {
      bold: true,
      rule: true,
    });
  }

  stampFooters(page, input.edition);
  doc.end();
  return finished;
}