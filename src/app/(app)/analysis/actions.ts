"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCsrf } from "@/lib/auth/csrf";
import { loanFromShortfall } from "@/lib/finance/analysis";
import { parseAmountToCents } from "@/lib/money";
import { flattenErrors, loanSchema, type FormState } from "@/lib/validation";
import { z } from "zod";
import { currentMonthKey } from "@/lib/dates";

/**
 * BR-3: money borrowed to cover a shortfall becomes a loan, and its interest
 * reduces future remaining money. This action is reached straight from the
 * shortfall warning on the dashboard, with the amount pre-filled.
 */
export async function recordShortfallAsLoanAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = z
    .object({
      amount: z.string().trim().min(1, "Enter the shortfall amount"),
      lender: z.string().trim().min(1, "Enter who you borrowed from").max(60),
      interestRatePct: z.coerce.number().min(0).max(100).default(0),
      method: z.enum(["flat", "reducing", "simple"]).default("reducing"),
      startDate: z.string().min(1, "Pick a start date"),
    })
    .safeParse({
      amount: formData.get("amount"),
      lender: formData.get("lender"),
      interestRatePct: formData.get("interestRatePct") ?? 0,
      method: formData.get("method") ?? "reducing",
      startDate: formData.get("startDate"),
    });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: flattenErrors(parsed.error) };
  }

  const shortfallCents = parseAmountToCents(parsed.data.amount);
  if (shortfallCents == null || shortfallCents <= 0) {
    return {
      status: "error",
      message: "Enter a valid amount.",
      errors: { amount: "Enter a valid amount" },
    };
  }

  const startDate = new Date(parsed.data.startDate);
  const dueDate = new Date(startDate);
  dueDate.setMonth(dueDate.getMonth() + 12);

  const template = loanFromShortfall(-shortfallCents, startDate);

  await prisma.loan.create({
    data: {
      userId: user.id,
      lender: parsed.data.lender,
      purpose: `Covering the ${currentMonthKey()} shortfall`,
      principalCents: template.principalCents,
      remainingBalanceCents: template.remainingBalanceCents,
      interestRatePct: parsed.data.interestRatePct,
      method: parsed.data.method,
      startDate,
      dueDate,
      sourceRef: template.sourceRef,
      notes: "Created from the monthly analysis shortfall.",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "loan.create",
      entityType: "loan",
      meta: JSON.stringify({ source: "shortfall", shortfallCents }),
    },
  });

  revalidatePath("/");
  revalidatePath("/analysis");
  revalidatePath("/financial/loans");
  redirect("/financial/loans?created=shortfall");
}

/** Update the remaining balance of a loan the user has partly repaid. */
export async function updateLoanBalanceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = loanSchema.shape.remainingBalance.safeParse(formData.get("remainingBalance"));
  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "error", message: "That loan could not be found." };

  const remaining = parseAmountToCents(parsed.data ?? "");
  const existing = await prisma.loan.findFirst({ where: { id, userId: user.id, deletedAt: null } });
  if (!existing) return { status: "error", message: "That loan no longer exists." };
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid remaining balance.",
      errors: { remainingBalance: parsed.error.issues[0]?.message ?? "Enter a valid amount" },
    };
  }

  await prisma.loan.update({ where: { id: existing.id }, data: { remainingBalanceCents: remaining ?? 0 } });
  revalidatePath("/financial/loans");
  revalidatePath("/");
  return { status: "success", message: "Remaining balance updated." };
}
