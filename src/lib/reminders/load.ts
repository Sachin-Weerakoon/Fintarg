import { prisma } from "@/lib/db";
import { collectUpcoming, type UpcomingItem } from "@/lib/reminders";
import { loadAnalysis } from "@/lib/finance/load";
import { isEdition } from "@/lib/plans";
import type { MonthKey } from "@/lib/dates";

/**
 * Loads every upcoming money date for one account (FR-4: one list of what is due).
 *
 * The dashboard, the analysis screen and the reminders centre all need this, and
 * they must not disagree about what is due next. Gathering it here also keeps the
 * `userId` scoping in a single place (BR-8).
 *
 * A medical reminder is read from the persisted `Reminder` rows rather than
 * recomputed, because a dose date comes from the record itself.
 */
export async function loadUpcomingItems(input: {
  userId: string;
  month: MonthKey;
  today?: Date;
  edition?: string;
  monthsAhead?: number;
}): Promise<UpcomingItem[]> {
  const { userId, month, edition } = input;
  const today = input.today ?? new Date();
  const includeAgreements = isEdition(edition ?? null) && edition === "business";

  const [{ raw }, medicalReminders, agreements] = await Promise.all([
    loadAnalysis(userId, month, { today }),
    prisma.reminder.findMany({
      where: {
        userId,
        status: "pending",
        // Yesterday onward: a reminder missed yesterday is still worth showing.
        dueDate: { gte: new Date(today.getTime() - 86_400_000) },
        kind: "medical",
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    includeAgreements
      ? prisma.agreement.findMany({
          where: { userId, deletedAt: null, endDate: { not: null } },
          orderBy: { endDate: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  return collectUpcoming(
    {
      financePayments: raw.financePayments,
      pawnedItems: raw.pawnedItems,
      loans: raw.loans,
      goals: raw.goals.map((goal) => ({
        id: goal.id,
        name: goal.name,
        remainingCents: Math.max(0, goal.targetAmountCents - goal.savedCents),
        endDate: goal.endDate ?? null,
      })),
      medicalReminders: medicalReminders.map((row) => ({
        id: row.id,
        title: row.title,
        dueDate: row.dueDate,
      })),
      agreements: agreements.map((row) => ({
        id: row.id,
        title: row.title,
        otherParty: row.otherParty,
        endDate: row.endDate,
        status: row.status,
      })),
    },
    { today, month, monthsAhead: input.monthsAhead },
  );
}