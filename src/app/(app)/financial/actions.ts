"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCsrf } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/session";
import { formatMoney, parseAmountToCents } from "@/lib/money";
import { fromDateInputValue } from "@/lib/dates";
import {
  expenseSchema,
  financePaymentSchema,
  flattenErrors,
  incomeSchema,
  loanSchema,
  personalPlanSchema,
  pawnedItemSchema,
  type FieldErrors,
  type FormState,
} from "@/lib/validation";

/**
 * Financial section server actions (FR-2 .. FR-4, FR-7).
 *
 * Every action follows the same shape: CSRF first, then the signed-in user, then
 * zod validation, then integer-cents persistence scoped by `userId` (BR-8).
 * Deletes are always soft deletes so money history is never destroyed.
 */

function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function optionalStr(formData: FormData, name: string): string | undefined {
  const value = str(formData, name).trim();
  return value === "" ? undefined : value;
}

/** Empty inputs must become `undefined`, otherwise `z.coerce.number()` yields 0. */
function optionalNum(formData: FormData, name: string): number | undefined {
  const value = optionalStr(formData, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function optionalDate(formData: FormData, name: string): Date | undefined {
  const value = optionalStr(formData, name);
  if (value === undefined) return undefined;
  return fromDateInputValue(value) ?? undefined;
}

function cents(formData: FormData, name: string): number {
  return parseAmountToCents(str(formData, name)) ?? 0;
}

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user.id;
}

function fail(message: string, errors?: FieldErrors): FormState {
  return errors ? { status: "error", message, errors } : { status: "error", message };
}

async function audit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  meta: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: { userId, action, entityType, entityId, meta: JSON.stringify(meta) },
  });
}

/* ------------------------------------------------------------------- income */

export async function createIncomeAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);
  const userId = await requireUserId();

  const parsed = incomeSchema.safeParse({
    sourceName: str(formData, "sourceName"),
    kind: str(formData, "kind"),
    amount: str(formData, "amount"),
    frequency: str(formData, "frequency"),
    date: str(formData, "date"),
    recurring: formData.get("recurring"),
    customIntervalDays: optionalNum(formData, "customIntervalDays"),
    notes: optionalStr(formData, "notes"),
  });
  if (!parsed.success) {
    return fail("Check the income details and try again.", flattenErrors(parsed.error));
  }

  const data = parsed.data;
  const date = fromDateInputValue(data.date);
  if (!date) return fail("Check the income details and try again.", { date: "Pick a valid date" });

  await prisma.income.create({
    data: {
      userId,
      sourceName: data.sourceName,
      kind: data.kind,
      amountCents: parseAmountToCents(data.amount) ?? 0,
      frequency: data.frequency,
      date,
      recurring: data.recurring,
      customIntervalDays: data.frequency === "custom" ? data.customIntervalDays ?? null : null,
      notes: data.notes ?? null,
    },
  });

  revalidatePath("/financial");
  revalidatePath("/financial/income");
  revalidatePath("/analysis");
  revalidatePath("/dashboard");
  return { status: "success", message: `${data.sourceName} added to your income.` };
}

export async function deleteIncomeAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const userId = await requireUserId();
  const id = str(formData, "id");
  if (!id) return;

  await prisma.income.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt: new Date() } });
  revalidatePath("/financial");
  revalidatePath("/financial/income");
  revalidatePath("/analysis");
}

/* ----------------------------------------------------------------- expenses */

export async function createExpenseAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);
  const userId = await requireUserId();

  const parsed = expenseSchema.safeParse({
    date: str(formData, "date"),
    amount: str(formData, "amount"),
    categoryName: str(formData, "categoryName"),
    note: optionalStr(formData, "note"),
    recurring: formData.get("recurring"),
    isMedical: formData.get("isMedical"),
    isPersonal: formData.get("isPersonal"),
  });
  if (!parsed.success) {
    return fail("Check the expense details and try again.", flattenErrors(parsed.error));
  }

  const data = parsed.data;
  const date = fromDateInputValue(data.date);
  if (!date) return fail("Check the expense details and try again.", { date: "Pick a valid date" });

  const category = await prisma.expenseCategory.findFirst({
    where: { userId, name: data.categoryName, deletedAt: null },
  });

  await prisma.expense.create({
    data: {
      userId,
      date,
      amountCents: parseAmountToCents(data.amount) ?? 0,
      categoryId: category?.id ?? null,
      categoryName: data.categoryName,
      note: data.note ?? null,
      recurring: data.recurring,
      isMedical: data.isMedical,
      isPersonal: data.isPersonal,
    },
  });

  revalidatePath("/financial");
  revalidatePath("/financial/expenses");
  revalidatePath("/financial/personal-spending");
  revalidatePath("/analysis");
  revalidatePath("/dashboard");
  return { status: "success", message: "Expense saved." };
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const userId = await requireUserId();
  const id = str(formData, "id");
  if (!id) return;

  await prisma.expense.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt: new Date() } });
  revalidatePath("/financial");
  revalidatePath("/financial/expenses");
  revalidatePath("/financial/personal-spending");
  revalidatePath("/analysis");
}

/* --------------------------------------------------------- finance payments */

export async function createFinancePaymentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);
  const userId = await requireUserId();

  const parsed = financePaymentSchema.safeParse({
    lender: str(formData, "lender"),
    description: str(formData, "description"),
    amount: str(formData, "amount"),
    dueDayOfMonth: optionalNum(formData, "dueDayOfMonth"),
    monthsRemaining: optionalNum(formData, "monthsRemaining"),
    startDate: str(formData, "startDate"),
    active: formData.get("active"),
  });
  if (!parsed.success) {
    return fail("Check the payment details and try again.", flattenErrors(parsed.error));
  }

  const data = parsed.data;
  const startDate = fromDateInputValue(data.startDate);
  if (!startDate) {
    return fail("Check the payment details and try again.", { startDate: "Pick a valid date" });
  }

  await prisma.financePayment.create({
    data: {
      userId,
      lender: data.lender,
      description: data.description,
      amountCents: parseAmountToCents(data.amount) ?? 0,
      dueDayOfMonth: data.dueDayOfMonth,
      monthsRemaining: data.monthsRemaining ?? null,
      startDate,
      active: data.active,
    },
  });

  revalidatePath("/financial");
  revalidatePath("/financial/finance-payments");
  revalidatePath("/analysis");
  revalidatePath("/dashboard");
  return { status: "success", message: `${data.lender} payment added.` };
}

export async function deleteFinancePaymentAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const userId = await requireUserId();
  const id = str(formData, "id");
  if (!id) return;

  await prisma.financePayment.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/financial");
  revalidatePath("/financial/finance-payments");
  revalidatePath("/analysis");
}

/* -------------------------------------------------------------------- loans */

export async function createLoanAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);
  const userId = await requireUserId();

  const parsed = loanSchema.safeParse({
    lender: str(formData, "lender"),
    purpose: optionalStr(formData, "purpose"),
    principal: str(formData, "principal"),
    interestRatePct: optionalNum(formData, "interestRatePct") ?? 0,
    method: str(formData, "method"),
    startDate: str(formData, "startDate"),
    dueDate: optionalStr(formData, "dueDate"),
    remainingBalance: str(formData, "remainingBalance"),
    manualMonthlyInterest: optionalStr(formData, "manualMonthlyInterest"),
  });
  if (!parsed.success) {
    return fail("Check the loan details and try again.", flattenErrors(parsed.error));
  }

  const data = parsed.data;
  const startDate = fromDateInputValue(data.startDate);
  if (!startDate) {
    return fail("Check the loan details and try again.", { startDate: "Pick a valid date" });
  }
  const dueDate = data.dueDate ? fromDateInputValue(data.dueDate) : null;

  const principalCents = parseAmountToCents(data.principal) ?? 0;
  const remainingBalanceCents = parseAmountToCents(data.remainingBalance) ?? 0;
  const manualMonthlyInterestCents = data.manualMonthlyInterest
    ? parseAmountToCents(data.manualMonthlyInterest) ?? 0
    : null;

  await prisma.loan.create({
    data: {
      userId,
      lender: data.lender,
      purpose: data.purpose ?? null,
      principalCents,
      interestRatePct: data.interestRatePct,
      method: data.method,
      startDate,
      dueDate,
      remainingBalanceCents,
      manualMonthlyInterestCents,
    },
  });

  revalidatePath("/financial");
  revalidatePath("/financial/loans");
  revalidatePath("/analysis");
  revalidatePath("/dashboard");
  return { status: "success", message: `${data.lender} loan added.` };
}

/**
 * Reduce the balance you still owe. The repaid amount is stored in the audit log
 * so the history of a loan stays readable after the balance moves on.
 */
export async function recordLoanRepaymentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);
  const userId = await requireUserId();

  const loanId = str(formData, "loanId");
  const repaidCents = parseAmountToCents(str(formData, "repaymentAmount"));
  if (!loanId) return fail("Pick a loan first.", { loanId: "Pick a loan" });
  if (repaidCents == null || repaidCents <= 0) {
    return fail("Enter how much you paid.", { repaymentAmount: "Enter an amount" });
  }

  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId, deletedAt: null } });
  if (!loan) return fail("That loan is no longer available.", { loanId: "Pick a loan" });

  const nextBalance = Math.max(0, loan.remainingBalanceCents - repaidCents);
  await prisma.loan.updateMany({
    where: { id: loan.id, userId },
    data: { remainingBalanceCents: nextBalance },
  });
  await audit(userId, "loan.repayment", "Loan", loan.id, {
    repaidCents,
    previousBalanceCents: loan.remainingBalanceCents,
    remainingBalanceCents: nextBalance,
  });

  revalidatePath("/financial");
  revalidatePath("/financial/loans");
  revalidatePath("/analysis");
  return {
    status: "success",
    message: `Repayment recorded. You now owe ${formatMoney(nextBalance)} on this loan.`,
  };
}

export async function deleteLoanAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const userId = await requireUserId();
  const id = str(formData, "id");
  if (!id) return;

  await prisma.loan.updateMany({ where: { id, userId, deletedAt: null }, data: { deletedAt: new Date() } });
  revalidatePath("/financial");
  revalidatePath("/financial/loans");
  revalidatePath("/analysis");
}

/* ------------------------------------------------------------ pawned items */

export async function createPawnedItemAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);
  const userId = await requireUserId();

  const parsed = pawnedItemSchema.safeParse({
    description: str(formData, "description"),
    amountReceived: str(formData, "amountReceived"),
    interestRatePct: optionalNum(formData, "interestRatePct") ?? 0,
    monthlyInterest: optionalStr(formData, "monthlyInterest"),
    nextInterestDueDate: optionalStr(formData, "nextInterestDueDate"),
    redemptionDate: optionalStr(formData, "redemptionDate"),
    notes: optionalStr(formData, "notes"),
  });
  if (!parsed.success) {
    return fail("Check the item details and try again.", flattenErrors(parsed.error));
  }

  const data = parsed.data;
  const nextInterestDueDate = data.nextInterestDueDate
    ? fromDateInputValue(data.nextInterestDueDate)
    : null;
  const redemptionDate = data.redemptionDate ? fromDateInputValue(data.redemptionDate) : null;

  await prisma.pawnedItem.create({
    data: {
      userId,
      description: data.description,
      amountReceivedCents: parseAmountToCents(data.amountReceived) ?? 0,
      interestRatePct: data.interestRatePct,
      monthlyInterestCents: data.monthlyInterest ? parseAmountToCents(data.monthlyInterest) ?? 0 : 0,
      nextInterestDueDate,
      redemptionDate,
      notes: data.notes ?? null,
    },
  });

  revalidatePath("/financial");
  revalidatePath("/financial/pawned");
  revalidatePath("/analysis");
  revalidatePath("/dashboard");
  return { status: "success", message: `${data.description} added.` };
}

/** One-tap "interest paid": move the due date on by a month and record it. */
export async function markPawnInterestPaidAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const userId = await requireUserId();
  const id = str(formData, "id");
  if (!id) return;

  const item = await prisma.pawnedItem.findFirst({ where: { id, userId, deletedAt: null } });
  if (!item) return;

  const base = item.nextInterestDueDate ?? new Date();
  const next = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());

  await prisma.pawnedItem.updateMany({ where: { id: item.id, userId }, data: { nextInterestDueDate: next } });
  await audit(userId, "pawn.interest_paid", "PawnedItem", item.id, {
    paidOn: new Date().toISOString(),
    previousDueDate: base.toISOString(),
    nextInterestDueDate: next.toISOString(),
  });

  revalidatePath("/financial");
  revalidatePath("/financial/pawned");
  revalidatePath("/analysis");
}

export async function deletePawnedItemAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const userId = await requireUserId();
  const id = str(formData, "id");
  if (!id) return;

  await prisma.pawnedItem.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/financial");
  revalidatePath("/financial/pawned");
  revalidatePath("/analysis");
}

/* ------------------------------------------------- personal spending plan */

export async function savePersonalPlanAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);
  const userId = await requireUserId();

  const parsed = personalPlanSchema.safeParse({
    month: str(formData, "month"),
    plannedAmount: str(formData, "plannedAmount"),
  });
  if (!parsed.success) {
    return fail("Check the plan details and try again.", flattenErrors(parsed.error));
  }

  const plannedAmountCents = parseAmountToCents(parsed.data.plannedAmount) ?? 0;

  await prisma.personalSpendingPlan.upsert({
    where: { userId_month: { userId, month: parsed.data.month } },
    create: { userId, month: parsed.data.month, plannedAmountCents },
    update: { plannedAmountCents },
  });

  revalidatePath("/financial");
  revalidatePath("/financial/personal-spending");
  revalidatePath("/analysis");
  revalidatePath("/dashboard");
  return { status: "success", message: "Your monthly plan is saved." };
}
