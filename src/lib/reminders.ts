import { addMonths, endOfMonth, startOfMonth } from "date-fns";
import { daysUntil, type MonthKey } from "@/lib/dates";
import type { Cents } from "@/lib/money";
import { loanMonthlyInterestCents, pawnMonthlyInterestCents } from "@/lib/finance/analysis";

/**
 * Upcoming money dates, gathered in one place so the dashboard, the analysis
 * screen and the reminders section never disagree about what is due next.
 */
export interface UpcomingItem {
  id: string;
  title: string;
  detail: string;
  dueDate: Date;
  daysAway: number;
  amountCents?: Cents;
  kind: "finance_payment" | "pawn_interest" | "loan" | "goal" | "medical" | "agreement";
  href?: string;
  /** Colour + text + icon together - never colour alone. */
  urgency: "overdue" | "urgent" | "soon" | "later";
}

function urgencyOf(daysAway: number): UpcomingItem["urgency"] {
  if (daysAway < 0) return "overdue";
  if (daysAway <= 7) return "urgent";
  if (daysAway <= 30) return "soon";
  return "later";
}

export function dueDateIn(dayOfMonth: number, month: MonthKey): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  const base = new Date(year, monthNumber - 1, 1);
  const last = endOfMonth(base).getDate();
  return new Date(year, monthNumber - 1, Math.min(Math.max(1, dayOfMonth), last));
}

export interface ReminderSources {
  financePayments: { id: string; lender: string; description: string; amountCents: Cents; dueDayOfMonth: number; monthsRemaining?: number | null; startDate?: Date | null; active: boolean }[];
  pawnedItems: { id: string; description: string; monthlyInterestCents: Cents; interestRatePct: number; amountReceivedCents: Cents; nextInterestDueDate?: Date | null; redemptionDate?: Date | null }[];
  loans: { id: string; lender: string; dueDate?: Date | null; interestRatePct: number; principalCents: Cents; remainingBalanceCents: Cents; method: "flat" | "reducing" | "simple" | "compound"; manualMonthlyInterestCents?: number | null; startDate?: Date | null }[];
  goals: { id: string; name: string; remainingCents: Cents; endDate?: Date | null }[];
  medicalReminders: { id: string; title: string; dueDate: Date }[];
  agreements: { id: string; title: string; otherParty: string; endDate?: Date | null; status: string }[];
}

export function collectUpcoming(
  sources: ReminderSources,
  options: { today?: Date; monthsAhead?: number; month: MonthKey } = { month: "" },
): UpcomingItem[] {
  const today = options.today ?? new Date();
  const monthsAhead = options.monthsAhead ?? 1;
  const items: UpcomingItem[] = [];

  const add = (item: Omit<UpcomingItem, "urgency" | "daysAway"> & { daysAway?: number }) => {
    const daysAway = item.daysAway ?? daysUntil(item.dueDate, today);
    items.push({ ...item, daysAway, urgency: urgencyOf(daysAway) });
  };

  for (const payment of sources.financePayments) {
    if (!payment.active) continue;
    const startDate = payment.startDate ?? today;
    // B5: a payment that has run its course must stop producing reminders.
    const monthsElapsed = monthDistance(monthKeyOf(startDate), monthKeyOf(today));
    if (monthsElapsed < 0) continue; // does not start until its start month
    if (payment.monthsRemaining != null && monthsElapsed >= payment.monthsRemaining) continue;

    const due = dueDateIn(payment.dueDayOfMonth, options.month);
    // Roll forward to the next occurrence when today's date has passed.
    const resolved = due < startOfDay(today) ? dueDateIn(payment.dueDayOfMonth, monthKeyOf(addMonths(today, 1))) : due;

    // Never schedule past the final instalment.
    const instalmentIndex = monthsElapsed + (resolved.getMonth() === today.getMonth() ? 0 : 1);
    if (payment.monthsRemaining != null && instalmentIndex >= payment.monthsRemaining) continue;

    add({
      id: `finance-${payment.id}`,
      title: `${payment.lender} payment`,
      detail: payment.description,
      dueDate: resolved,
      amountCents: payment.amountCents,
      kind: "finance_payment",
      href: "/financial/finance-payments",
    });
  }

  for (const item of sources.pawnedItems) {
    if (item.nextInterestDueDate) {
      add({
        id: `pawn-${item.id}`,
        title: `Pawn interest - ${item.description}`,
        detail: "Pay the interest to keep the item",
        dueDate: item.nextInterestDueDate,
        amountCents: pawnMonthlyInterestCents(item),
        kind: "pawn_interest",
        href: "/financial/pawned",
      });
    }
    if (item.redemptionDate) {
      add({
        id: `redeem-${item.id}`,
        title: `Redeem ${item.description}`,
        detail: "Bring the item back to get it",
        dueDate: item.redemptionDate,
        kind: "pawn_interest",
        href: "/financial/pawned",
      });
    }
  }

  for (const loan of sources.loans) {
    if (loan.dueDate) {
      add({
        id: `loan-${loan.id}`,
        title: `${loan.lender} loan ends`,
        detail: "Finish paying before this date",
        dueDate: loan.dueDate,
        amountCents: loan.remainingBalanceCents,
        kind: "loan",
        href: "/financial/loans",
      });
    }
  }

  for (const goal of sources.goals) {
    if (!goal.endDate || goal.remainingCents <= 0) continue;
    add({
      id: `goal-${goal.id}`,
      title: goal.name,
      detail: "Savings goal target date",
      dueDate: goal.endDate,
      amountCents: goal.remainingCents,
      kind: "goal",
      href: "/goals",
    });
  }

  for (const reminder of sources.medicalReminders) {
    add({
      id: `medical-${reminder.id}`,
      title: reminder.title,
      detail: "Medical reminder",
      dueDate: reminder.dueDate,
      kind: "medical",
      href: "/medical",
    });
  }

  for (const agreement of sources.agreements) {
    if (!agreement.endDate) continue;
    if (daysUntil(agreement.endDate, today) > monthsAhead * 30) continue;
    add({
      id: `agreement-${agreement.id}`,
      title: agreement.title,
      detail: `Agreement with ${agreement.otherParty} ends`,
      dueDate: agreement.endDate,
      kind: "agreement",
      href: "/advanced",
    });
  }

  return items.sort((a, b) => a.daysAway - b.daysAway);
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function monthKeyOf(date: Date): MonthKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Whole months from one month key to another; negative when `to` is earlier. */
function monthDistance(from: MonthKey, to: MonthKey): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty! - fy!) * 12 + (tm! - fm!);
}

export { urgencyOf };
