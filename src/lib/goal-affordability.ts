import { formatMoney, type Cents } from "@/lib/money";

/**
 * D6: what is left if every savings goal is funded this month.
 *
 * This is **display only**. It is deliberately not part of BR-1 outflow, because
 * BR-5 says an unfundable goal is flagged rather than budgeted - budgeting money
 * that is not there would hide the very shortfall the user needs to see.
 *
 * Pure, so the goals screen, the analysis screen, the PDF and the unit tests all
 * say the same words about the same numbers.
 */

export type AffordabilityTone = "positive" | "warning" | "danger";

export interface GoalAffordability {
  /** Sum of what every goal asks for this month. */
  goalsRequiredCents: Cents;
  /** Income minus `goalsRequiredCents`. May be negative. */
  leftAfterGoalsCents: Cents;
  /** False when funding every goal would leave nothing, or go negative. */
  affordable: boolean;
  /** One short sentence with the figure in it. */
  headline: string;
  /** A second sentence explaining how to read it. */
  detail: string;
  tone: AffordabilityTone;
}

export function describeGoalAffordability(input: {
  incomeCents: Cents;
  goalsRequiredCents: Cents;
  goalCount: number;
}): GoalAffordability {
  const { incomeCents, goalsRequiredCents, goalCount } = input;
  const leftAfterGoalsCents = incomeCents - goalsRequiredCents;
  const affordable = goalCount > 0 && goalsRequiredCents > 0 && leftAfterGoalsCents >= 0;

  if (goalCount === 0 || goalsRequiredCents === 0) {
    return {
      goalsRequiredCents,
      leftAfterGoalsCents,
      affordable: false,
      headline: "Nothing is being saved this month",
      detail: "Add a goal and Fintarg will tell you what is left after funding it.",
      tone: "positive",
    };
  }

  const goalWord = goalCount === 1 ? "goal" : "goals";

  if (leftAfterGoalsCents < 0) {
    return {
      goalsRequiredCents,
      leftAfterGoalsCents,
      affordable: false,
      headline: `Saving for all ${goalCount} ${goalWord} this month needs ${formatMoney(goalsRequiredCents)}, but your income is ${formatMoney(incomeCents)}`,
      detail: `That is ${formatMoney(-leftAfterGoalsCents)} more than you have coming in. Your goals are kept on the list and flagged, not added to your outgoings.`,
      tone: "danger",
    };
  }

  if (leftAfterGoalsCents === 0) {
    return {
      goalsRequiredCents,
      leftAfterGoalsCents,
      affordable: true,
      headline: `All ${goalCount} ${goalWord} funded this month uses everything you have coming in`,
      detail: `You would break even at ${formatMoney(goalsRequiredCents)}, with nothing left for anything unplanned.`,
      tone: "warning",
    };
  }

  return {
    goalsRequiredCents,
    leftAfterGoalsCents,
    affordable: true,
    headline: `After saving ${formatMoney(goalsRequiredCents)} for ${goalCount === 1 ? "your goal" : `all ${goalCount} goals`}, you would have ${formatMoney(leftAfterGoalsCents)} left`,
    detail: "This is income only. Your bills, expenses and loan payments come out of it too.",
    tone: "positive",
  };
}