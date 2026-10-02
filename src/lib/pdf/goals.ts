import { formatMoney } from "@/lib/money";
import { formatDate, formatMonthLabel } from "@/lib/dates";
import { describeGoalAffordability } from "@/lib/goal-affordability";
import { daysUntil } from "@/lib/dates";
import { beginDocument, callout, documentHead, layout, note, row, sectionTitle, stampFooters, tableHead } from "./parts";
import type { Edition } from "@/lib/plans";

export interface GoalReportGoal {
  name: string;
  note: string | null;
  targetCents: number;
  savedCents: number;
  dailyCents: number;
  monthlyCents: number;
  endDate: Date | null;
  achievable: boolean;
  message: string;
}

export interface GoalReportInput {
  userName: string;
  todayLabel: string;
  month: string;
  edition: Edition;
  accentHex: string;
  incomeCents: number;
  goals: GoalReportGoal[];
  /** Total already saved across all goals. */
  savedTotalCents: number;
}

/**
 * Savings goals report.
 *
 * The document a person takes to a bank or a family member when asking to borrow
 * against a goal, or simply keeps to prove progress. It states plainly whether each
 * goal is fundable this month rather than implying every goal is achievable.
 */
export async function renderGoalsPdf(input: GoalReportInput): Promise<Buffer> {
  const { doc, finished } = beginDocument();
  const page = layout(doc);
  const money = (cents: number) => formatMoney(cents);
  const today = new Date();

  documentHead(page, {
    accentHex: input.accentHex,
    title: "Savings goals report",
    subtitle: `${formatMonthLabel(input.month)} · ${input.userName} · prepared ${input.todayLabel}`,
  });

  /* ---------------------------------------------------------------- headline */
  const totalTarget = input.goals.reduce((total, goal) => total + goal.targetCents, 0);
  const required = input.goals.reduce((total, goal) => total + goal.monthlyCents, 0);

  callout(page, {
    title: "Saved across all goals",
    value: money(input.savedTotalCents),
    caption: `of ${money(totalTarget)} in total across ${input.goals.length} ${
      input.goals.length === 1 ? "goal" : "goals"
    }`,
    tone: input.savedTotalCents >= totalTarget && totalTarget > 0 ? "positive" : "warning",
  });

  const affordability = describeGoalAffordability({
    incomeCents: input.incomeCents,
    goalsRequiredCents: required,
    goalCount: input.goals.length,
  });
  row(
    doc,
    "Money needed for every goal this month",
    money(required),
    page.left,
    page.right,
  );
  row(
    doc,
    affordability.affordable
      ? "Left after saving for every goal"
      : "Short if every goal is saved this month",
    money(affordability.leftAfterGoalsCents),
    page.left,
    page.right,
    { bold: true, rule: true, tone: affordability.affordable ? "positive" : "danger" },
  );
  note(doc, affordability.detail, page.left, page.width);

  /* ------------------------------------------------------------- goal detail */
  if (input.goals.length === 0) {
    row(doc, "No savings goals recorded yet.", "", page.left, page.right);
  }

  for (const goal of input.goals) {
    if (doc.y > doc.page.height - 160) doc.addPage();

    sectionTitle(doc, goal.name, page.left, page.right);
    if (goal.note) note(doc, goal.note, page.left, page.width);

    row(doc, "Saved so far", money(goal.savedCents), page.left, page.right);
    row(doc, "Target", money(goal.targetCents), page.left, page.right);
    row(
      doc,
      "Still to go",
      money(Math.max(0, goal.targetCents - goal.savedCents)),
      page.left,
      page.right,
    );
    row(doc, "Suggested each day", money(goal.dailyCents), page.left, page.right);
    row(doc, "Suggested this month", money(goal.monthlyCents), page.left, page.right);

    if (goal.endDate) {
      const days = daysUntil(goal.endDate, today);
      row(
        doc,
        `Target date ${formatDate(goal.endDate)}`,
        days < 0 ? `${Math.abs(days)} days past` : days === 0 ? "today" : `in ${days} days`,
        page.left,
        page.right,
      );
    }

    row(
      doc,
      "This month",
      goal.achievable ? "On track" : "Not possible this month",
      page.left,
      page.right,
      { bold: true, tone: goal.achievable ? "positive" : "warning" },
    );
    note(doc, goal.message, page.left, page.width);
    doc.moveDown(0.3);
  }

  /* -------------------------------------------------------------- how to read */
  sectionTitle(doc, "How to read this", page.left, page.right);
  note(
    doc,
    "A goal marked \"Not possible this month\" has not been removed and has not been added to your outgoings. " +
      "Fintarg flags it instead, so an unreachable saving never hides the shortfall you actually have.",
    page.left,
    page.width,
  );

  stampFooters(page, input.edition);
  doc.end();
  return finished;
}