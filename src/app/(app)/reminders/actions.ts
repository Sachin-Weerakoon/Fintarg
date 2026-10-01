"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCsrf } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Reminders centre actions.
 *
 * `status` only moves a row forward or to `dismissed`. A dismissed reminder still
 * comes back on the next sync if the underlying money date is still real, because
 * `syncReminders` upserts on the stable `dedupeKey` and only creates - it never
 * re-opens a row the user has already dealt with.
 *
 * Every read and write filters by `userId` (BR-8).
 */

const STATUSES = ["pending", "done", "dismissed"] as const;

function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user.id;
}

/** Tick a reminder off, or put it back. Not destructive, so no confirmation. */
export async function setReminderStatusAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const userId = await requireUserId();

  const id = str(formData, "id");
  const requested = str(formData, "status");
  if (!id || !STATUSES.includes(requested as (typeof STATUSES)[number])) return;

  // `updateMany` with userId in the where clause is what stops one user ticking
  // off another user's reminder by guessing an id.
  const result = await prisma.reminder.updateMany({
    where: { id, userId },
    data: { status: requested },
  });
  if (result.count === 0) return;

  revalidatePath("/reminders");
  revalidatePath("/");
}