"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCsrf } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/session";
import { deriveGoalAmounts } from "@/lib/finance/load";
import { currentMonthKey, daysInMonth, fromDateInputValue } from "@/lib/dates";
import { parseAmountToCents } from "@/lib/money";
import {
  contributionSchema,
  flattenErrors,
  savingsGoalSchema,
  type FormState,
} from "@/lib/validation";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function revalidateGoals(goalId?: string): void {
  revalidatePath("/goals");
  revalidatePath("/");
  if (goalId) {
    revalidatePath(`/goals/${goalId}`);
    revalidatePath("/analysis");
  }
}

/** FR-6: create a goal. Either the daily or the monthly amount may be given. */
export async function createGoalAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = savingsGoalSchema.safeParse({
    name: text(formData, "name"),
    targetAmount: text(formData, "targetAmount"),
    mode: text(formData, "mode"),
    dailyAmount: text(formData, "dailyAmount"),
    monthlyTarget: text(formData, "monthlyTarget"),
    endDate: text(formData, "endDate"),
    note: text(formData, "note"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: flattenErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const targetCents = parseAmountToCents(data.targetAmount);
  if (targetCents === null || targetCents <= 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: { targetAmount: "Enter a valid amount" },
    };
  }

  // The user may think in either direction, so whichever side is missing is
  // derived from the target and this month's length (BR-4).
  const dailyGiven = parseAmountToCents(data.dailyAmount ?? "");
  const monthlyGiven = parseAmountToCents(data.monthlyTarget ?? "");
  const month = currentMonthKey();
  const derived = deriveGoalAmounts({
    targetAmountCents: targetCents,
    mode: data.mode,
    daysInMonth: daysInMonth(month),
  });

  const dailyCents = dailyGiven !== null && dailyGiven > 0 ? dailyGiven : derived.dailyAmountCents;
  const monthlyCents =
    monthlyGiven !== null && monthlyGiven > 0
      ? monthlyGiven
      : Math.min(targetCents, Math.max(derived.monthlyTargetCents, dailyCents * daysInMonth(month)));

  const endDate = data.endDate ? fromDateInputValue(data.endDate) : null;

  await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name: data.name,
      targetAmountCents: targetCents,
      endDate,
      mode: data.mode,
      dailyAmountCents: dailyCents,
      monthlyTargetCents: monthlyCents,
      note: data.note ?? null,
    },
  });

  revalidateGoals();
  return { status: "success", message: `Goal "${data.name}" saved.` };
}

/** FR-6: log money into a goal. A daily amount and a lump sum are the same field. */
export async function addContributionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = contributionSchema.safeParse({
    goalId: text(formData, "goalId"),
    amount: text(formData, "amount"),
    date: text(formData, "date"),
    note: text(formData, "note"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: flattenErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const goal = await prisma.savingsGoal.findFirst({
    where: { id: data.goalId, userId: user.id, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!goal) {
    return { status: "error", message: "That goal is no longer available." };
  }

  const amountCents = parseAmountToCents(data.amount);
  if (amountCents === null || amountCents <= 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: { amount: "Enter a valid amount" },
    };
  }

  const date = fromDateInputValue(data.date) ?? new Date();

  await prisma.contribution.create({
    data: {
      userId: user.id,
      goalId: goal.id,
      date,
      amountCents,
      note: data.note ?? null,
    },
  });

  revalidateGoals(goal.id);
  return { status: "success", message: "Savings added. Nice work." };
}

/** Destructive: soft delete a goal, always behind the confirm dialog. */
export async function deleteGoalAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = text(formData, "id");
  if (!id) return;

  await prisma.savingsGoal.updateMany({
    where: { id, userId: user.id },
    data: { deletedAt: new Date() },
  });

  revalidateGoals(id);
}

/** Destructive: remove one contribution. */
export async function deleteContributionAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = text(formData, "id");
  if (!id) return;

  const contribution = await prisma.contribution.findFirst({
    where: { id, userId: user.id },
    select: { goalId: true },
  });
  if (!contribution) return;

  await prisma.contribution.delete({ where: { id } });
  revalidateGoals(contribution.goalId);
}
