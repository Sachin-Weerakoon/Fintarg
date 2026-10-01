import { prisma } from "@/lib/db";
import { currentMonthKey, daysInMonth, daysUntil, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { collectUpcoming, type ReminderSources } from "@/lib/reminders";

/**
 * Reminder scheduling (NFR: "Reminders: email by default").
 *
 * `syncReminders` materialises one row per upcoming money date for the next
 * `windowDays`, using a stable `dedupeKey` so re-running it never duplicates a
 * reminder. `dueReminders` then picks the rows that are close enough to be worth
 * an email and have not been sent yet.
 */

const MS_DAY = 86_400_000;

/**
 * Ceiling on any user's lead-time setting, and the bounds the Settings form
 * enforces (`min(0).max(30)`). The query window has to reach this far so no user
 * is silently left out by the widest preference in the system.
 */
export const MAX_LEAD_DAYS = 30;
const DEFAULT_LEAD_DAYS = 3;

const APP_ORIGIN = (process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/+$/, "");

export function reminderKey(kind: string, entityId: string, dueDate: Date): string {
  return `${kind}:${entityId}:${dueDate.toISOString().slice(0, 10)}`;
}

export async function syncReminders(userId: string, options: { today?: Date; windowDays?: number } = {}) {
  const today = options.today ?? new Date();
  const windowDays = options.windowDays ?? 30;
  const month = currentMonthKey();

  const [financePayments, pawnedItems, loans, goals, agreements, medical] = await Promise.all([
    prisma.financePayment.findMany({ where: { userId, deletedAt: null, active: true } }),
    prisma.pawnedItem.findMany({ where: { userId, deletedAt: null } }),
    prisma.loan.findMany({ where: { userId, deletedAt: null } }),
    prisma.savingsGoal.findMany({
      where: { userId, deletedAt: null },
      include: { contributions: true },
    }),
    prisma.agreement.findMany({ where: { userId, deletedAt: null, endDate: { not: null } } }),
    prisma.medicalRecord.findMany({
      where: { userId, deletedAt: null, nextDoseAt: { not: null } },
    }),
  ]);

  const sources: ReminderSources = {
    financePayments: financePayments.map((payment) => ({
      id: payment.id,
      lender: payment.lender,
      description: payment.description,
      amountCents: payment.amountCents,
      dueDayOfMonth: payment.dueDayOfMonth,
      monthsRemaining: payment.monthsRemaining,
      startDate: payment.startDate,
      active: payment.active,
    })),
    pawnedItems: pawnedItems.map((item) => ({
      id: item.id,
      description: item.description,
      monthlyInterestCents: item.monthlyInterestCents,
      interestRatePct: item.interestRatePct,
      amountReceivedCents: item.amountReceivedCents,
      nextInterestDueDate: item.nextInterestDueDate,
      redemptionDate: item.redemptionDate,
    })),
    loans: loans.map((loan) => ({
      id: loan.id,
      lender: loan.lender,
      dueDate: loan.dueDate,
      interestRatePct: loan.interestRatePct,
      principalCents: loan.principalCents,
      remainingBalanceCents: loan.remainingBalanceCents,
      method: loan.method as "flat" | "reducing" | "simple" | "compound",
      manualMonthlyInterestCents: loan.manualMonthlyInterestCents,
      startDate: loan.startDate,
    })),
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      remainingCents: Math.max(0, goal.targetAmountCents - goal.contributions.reduce((total, c) => total + c.amountCents, 0)),
      endDate: goal.endDate,
    })),
    medicalReminders: medical.map((record) => ({
      id: record.id,
      title: record.title,
      dueDate: record.nextDoseAt as Date,
    })),
    agreements: agreements.map((agreement) => ({
      id: agreement.id,
      title: agreement.title,
      otherParty: agreement.otherParty,
      endDate: agreement.endDate,
      status: agreement.status,
    })),
  };

  const upcoming = collectUpcoming(sources, { today, month, monthsAhead: 2 });

  // Only schedule dates that fall inside the window.
  const inWindow = upcoming.filter((item) => item.daysAway >= -1 && item.daysAway <= windowDays);

  let created = 0;
  for (const item of inWindow) {
    const dedupeKey = reminderKey(item.kind, item.id.split("-").slice(1).join("-"), item.dueDate);
    const result = await prisma.reminder.upsert({
      where: { dedupeKey },
      create: {
        userId,
        kind: item.kind,
        title: item.title,
        dueDate: item.dueDate,
        entityType: item.kind,
        entityId: item.id,
        dedupeKey,
        channel: "email",
      },
      update: {
        title: item.title,
        dueDate: item.dueDate,
        status: "pending",
      },
    });
    if (!result.sentAt && result.status === "pending") created += 1;
  }

  return { scheduled: inWindow.length, windowDays, monthDays: daysInMonth(month) };
}

export interface DueReminder {
  id: string;
  /** Null when the account has no email; the SMS channel handles those. */
  email: string | null;
  mobile: string | null;
  userName: string;
  kind: string;
  title: string;
  detail: string;
  dueDate: Date;
  amountCents?: number;
}

/**
 * Reminders that are due soon enough to be worth emailing, and unsent.
 *
 * The lead time is a *per-user* preference (`profile.reminderLeadDays`), so this
 * queries the widest window any user could ask for and then filters each row
 * against that account's own setting. Passing `leadDays` overrides it for testing;
 * `null` means "use each account's setting".
 *
 * A row more than one day past due is still included: someone who was offline
 * yesterday should still hear about it today.
 */
export async function dueReminders(
  options: { now?: Date; leadDays?: number | null } = {},
): Promise<DueReminder[]> {
  const now = options.now ?? new Date();
  const override = options.leadDays;
  const queryDays = override ?? MAX_LEAD_DAYS;
  const horizon = new Date(now.getTime() + queryDays * MS_DAY);

  const rows = await prisma.reminder.findMany({
    where: {
      status: "pending",
      sentAt: null,
      channel: "email",
      dueDate: { gte: new Date(now.getTime() - MS_DAY), lte: horizon },
      user: { suspendedAt: null },
    },
    orderBy: { dueDate: "asc" },
    take: 2000,
    include: { user: { include: { profile: true } } },
  });

  return rows
    .map((row) => {
      const profile = row.user.profile;
      // A user with no profile row is on the defaults: reminders on, 3 days ahead.
      const enabled = profile?.remindersEnabled !== false;
      const leadDays = override ?? profile?.reminderLeadDays ?? DEFAULT_LEAD_DAYS;
      return { row, profile, enabled, leadDays };
    })
    .filter(({ row, enabled, leadDays }) => enabled && daysUntil(row.dueDate, now) <= leadDays)
    .map(({ row, profile }) => ({
      id: row.id,
      email: row.user.email,
      mobile: row.user.mobile,
      userName: profile?.fullName ?? row.user.email?.split("@")[0] ?? row.user.mobile ?? "there",
      kind: row.kind,
      title: row.title,
      detail: describeKind(row.kind),
      dueDate: row.dueDate,
    }));
}

function describeKind(kind: string): string {
  switch (kind) {
    case "finance_payment":
      return "a fixed payment you set up";
    case "pawn_interest":
      return "pawn interest due";
    case "loan":
      return "a loan date";
    case "goal":
      return "a savings goal target date";
    case "medical":
      return "a medical reminder";
    case "agreement":
      return "an agreement ending";
    default:
      return "a money date";
  }
}

export function reminderEmail(reminder: DueReminder): { subject: string; text: string } {
  const when = daysUntil(reminder.dueDate, new Date());
  const whenText =
    when < 0
      ? `was due ${formatDate(reminder.dueDate)}`
      : when === 0
        ? "is due today"
        : when === 1
          ? "is due tomorrow"
          : `is due on ${formatDate(reminder.dueDate)}`;

  return {
    subject: `Fintarg reminder: ${reminder.title}`,
    text: [
      `Hi ${reminder.userName},`,
      "",
      `This is a short reminder that ${reminder.title} ${whenText}.`,
      `It is ${reminder.detail}.`,
      "",
      "Open Fintarg to see how it affects this month's remaining money:",
      `${APP_ORIGIN}/`,
      "",
      "You can change or turn off reminders in Settings at any time.",
    ].join("\n"),
  };
}

export { formatMoney };

/**
 * SMS body for an account with no email (FR-1.1). Kept short on purpose - a long
 * message is truncated by most carriers, and the point is only to prompt a visit.
 */
export function reminderSms(reminder: DueReminder): string {
  const when = daysUntil(reminder.dueDate, new Date());
  const whenText =
    when < 0
      ? `was due ${formatDate(reminder.dueDate)}`
      : when === 0
        ? "is due today"
        : when === 1
          ? "is due tomorrow"
          : `is due on ${formatDate(reminder.dueDate)}`;

  return `Fintarg: ${reminder.title} ${whenText}. Open ${APP_ORIGIN}/ to see what it leaves this month.`;
}
