"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCsrf } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/session";
import { parseAmountToCents } from "@/lib/money";
import { fromDateInputValue } from "@/lib/dates";
import {
  flattenErrors,
  medicalRecordSchema,
  type FieldErrors,
  type FormState,
} from "@/lib/validation";

/**
 * Medical section server actions (FR-12).
 *
 * A medical record and the expense row it produces must never drift apart, so
 * the record, the matching `Expense` and any `Reminder` are written inside one
 * `prisma.$transaction`. Deletes are soft deletes so medical history is never
 * destroyed (BR-8 scoping: every write and read filters by `userId`).
 */

const MEDICAL_CATEGORY = "Medical";

function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fail(message: string, errors?: FieldErrors): FormState {
  return errors ? { status: "error", message, errors } : { status: "error", message };
}

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user.id;
}

export async function createMedicalRecordAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);
  const userId = await requireUserId();

  const parsed = medicalRecordSchema.safeParse({
    kind: str(formData, "kind"),
    date: str(formData, "date"),
    title: str(formData, "title"),
    provider: str(formData, "provider"),
    amount: str(formData, "amount"),
    notes: str(formData, "notes"),
    nextDoseAt: str(formData, "nextDoseAt"),
  });
  if (!parsed.success) {
    return fail("Check the details and try again.", flattenErrors(parsed.error));
  }

  const data = parsed.data;

  const date = fromDateInputValue(data.date);
  if (!date) return fail("Check the details and try again.", { date: "Pick a valid date" });

  const amountCents = data.amount ? parseAmountToCents(data.amount) : null;
  if (data.amount && (amountCents == null || amountCents <= 0)) {
    return fail("Check the details and try again.", { amount: "Enter a valid amount" });
  }

  const nextDoseAt = data.nextDoseAt ? fromDateInputValue(data.nextDoseAt) : null;
  if (data.nextDoseAt && !nextDoseAt) {
    return fail("Check the details and try again.", { nextDoseAt: "Pick a valid date" });
  }

  const reminderTitle =
    data.kind === "appointment" ? `Appointment: ${data.title}` : `Next dose: ${data.title}`;

  // Appointments carry no money; expenses and medicines do, and that money must
  // reach the monthly analysis exactly once.
  const booksExpense = data.kind !== "appointment" && amountCents != null && amountCents > 0;

  await prisma.$transaction(async (tx) => {
    const record = await tx.medicalRecord.create({
      data: {
        userId,
        kind: data.kind,
        date,
        title: data.title,
        provider: data.provider ?? null,
        amountCents,
        notes: data.notes ?? null,
        nextDoseAt,
      },
    });

    if (booksExpense && amountCents != null) {
      const category = await tx.expenseCategory.findFirst({
        where: {
          name: MEDICAL_CATEGORY,
          deletedAt: null,
          OR: [{ userId }, { userId: null }],
        },
      });
      await tx.expense.create({
        data: {
          userId,
          date,
          amountCents,
          categoryId: category?.id ?? null,
          categoryName: MEDICAL_CATEGORY,
          note: data.provider ? `${data.title} - ${data.provider}` : data.title,
          isMedical: true,
          isPersonal: false,
          medicalRecordId: record.id,
        },
      });
    }

    if (nextDoseAt) {
      await tx.reminder.create({
        data: {
          userId,
          kind: "medical",
          title: reminderTitle,
          dueDate: nextDoseAt,
          entityType: "MedicalRecord",
          entityId: record.id,
        },
      });
    }
  });

  revalidatePath("/medical");
  revalidatePath("/financial");
  revalidatePath("/analysis");

  return {
    status: "success",
    message: booksExpense
      ? "Saved. This amount is now part of your monthly analysis."
      : "Saved to your medical records.",
  };
}

/**
 * Soft delete a record. The row is kept so past months stay explainable, but the
 * expense it booked must go too - otherwise deleting a Rs. 4,000 consultation
 * would silently keep shrinking the user's monthly remaining money.
 */
export async function deleteMedicalRecordAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const userId = await requireUserId();
  const id = str(formData, "id");
  if (!id) return;

  await prisma.$transaction([
    prisma.medicalRecord.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.expense.updateMany({
      where: { userId, medicalRecordId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    prisma.reminder.updateMany({
      where: { userId, kind: "medical", entityType: "MedicalRecord", entityId: id, status: "pending" },
      data: { status: "dismissed" },
    }),
  ]);

  revalidatePath("/medical");
  revalidatePath("/financial");
  revalidatePath("/analysis");
}

/** Ticking off a reminder is not destructive, so it needs no confirmation. */
export async function completeMedicalReminderAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const userId = await requireUserId();
  const id = str(formData, "id");
  if (!id) return;

  const reminder = await prisma.reminder.findFirst({
    where: { id, userId, kind: "medical", status: "pending" },
    select: { id: true },
  });
  if (!reminder) return;

  await prisma.reminder.updateMany({
    where: { id: reminder.id, userId, status: "pending" },
    data: { status: "done" },
  });

  revalidatePath("/medical");
}
