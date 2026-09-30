"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCsrf, ensureCsrfToken } from "@/lib/auth/csrf";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  appearanceSchema,
  contactSchema,
  flattenErrors,
  profileSchema,
  type FormState,
} from "@/lib/validation";
import { ensureReadableOnWhite } from "@/lib/theme";
import { isEdition } from "@/lib/plans";
import { requestAccountDeletion } from "@/lib/deletion";
import { z } from "zod";

/** FR-8: appearance is stored on the profile, so it syncs across devices. */
export async function updateAppearanceAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = appearanceSchema.safeParse({
    themeAccent: formData.get("themeAccent"),
    themeMode: formData.get("themeMode"),
    fontScale: formData.get("fontScale"),
    density: formData.get("density"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: flattenErrors(parsed.error) };
  }

  // Design rule: a custom accent is darkened until white text passes 4.5:1.
  const accent = ensureReadableOnWhite(parsed.data.themeAccent);

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, themeAccent: accent, themeMode: parsed.data.themeMode, fontScale: parsed.data.fontScale, density: parsed.data.density },
    update: { themeAccent: accent, themeMode: parsed.data.themeMode, fontScale: parsed.data.fontScale, density: parsed.data.density },
  });

  revalidatePath("/", "layout");
  return {
    status: "success",
    message: accent !== ensureReadableOnWhite(parsed.data.themeAccent.toLowerCase())
      ? "Saved. We darkened that colour a little so white text stays readable."
      : "Saved. Your new look applies everywhere.",
  };
}

export async function updateProfileAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    mobile: formData.get("mobile") ?? "",
    email: formData.get("email"),
    address: formData.get("address") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    nicNumber: formData.get("nicNumber") ?? "",
    portfolioUrl: formData.get("portfolioUrl") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: flattenErrors(parsed.error) };
  }

  const data = parsed.data;

  if (data.email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email: data.email } });
    if (taken) {
      return { status: "error", message: "That email is already in use.", errors: { email: "That email is already in use" } };
    }
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { email: data.email } }),
    prisma.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName: data.fullName,
        mobile: data.mobile,
        address: data.address,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        nicNumber: data.nicNumber,
        portfolioUrl: data.portfolioUrl,
      },
      update: {
        fullName: data.fullName,
        mobile: data.mobile,
        address: data.address,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        nicNumber: data.nicNumber,
        portfolioUrl: data.portfolioUrl,
      },
    }),
  ]);

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  return { status: "success", message: "Your profile is up to date." };
}

export async function addContactAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    relationship: formData.get("relationship") ?? "",
    phone: formData.get("phone"),
    kind: formData.get("kind"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: flattenErrors(parsed.error) };
  }

  const count = await prisma.contact.count({ where: { userId: user.id } });
  if (count >= 12) {
    return { status: "error", message: "You can save up to 12 contacts. Remove one to add another." };
  }

  await prisma.contact.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      relationship: parsed.data.relationship,
      phone: parsed.data.phone,
      kind: parsed.data.kind,
      sortOrder: count,
    },
  });

  revalidatePath("/settings");
  return { status: "success", message: `${parsed.data.name} was added.` };
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = String(formData.get("id") ?? "");
  await prisma.contact.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/settings");
}

export async function changePasswordAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = z
    .object({
      currentPassword: z.string().min(1, "Enter your current password"),
      newPassword: z.string().min(8, "Use at least 8 characters").max(128),
    })
    .safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
    });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: flattenErrors(parsed.error) };
  }

  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return { status: "error", message: "Your account could not be found." };

  const valid = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!valid) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: { currentPassword: "That password is not right" } };
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });
  revalidatePath("/settings");
  return { status: "success", message: "Your password is changed." };
}

/**
 * FR-15 upgrade path, Basic -> Business.
 *
 * Billing is Phase 3, so this flips the edition immediately and records who
 * changed it. A payment provider would gate the same call.
 */
export async function upgradeToBusinessAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const requested = formData.get("edition");
  if (!isEdition(requested)) {
    return { status: "error", message: "That plan is not available." };
  }
  if (user.edition === requested) {
    return { status: "success", message: "You are already on that plan." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { edition: requested, plan: requested },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: `plan.${requested}`, entityType: "user" },
  });

  revalidatePath("/", "layout");
  revalidatePath("/advanced");
  revalidatePath("/letters");
  return {
    status: "success",
    message:
      requested === "business"
        ? "You are on the Business plan now. The Advanced section is unlocked."
        : "You are on the Basic plan now. Business-only sections are hidden.",
  };
}

export async function updateReminderPreferencesAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = z
    .object({
      remindersEnabled: z.coerce.boolean().default(false),
      reminderLeadDays: z.coerce.number().int().min(0).max(30).default(3),
    })
    .safeParse({
      remindersEnabled: formData.get("remindersEnabled") === "on" || formData.get("remindersEnabled") === "true",
      reminderLeadDays: formData.get("reminderLeadDays") ?? 3,
    });

  if (!parsed.success) {
    return { status: "error", message: "Please check the reminder settings.", errors: flattenErrors(parsed.error) };
  }

  await prisma.profile.update({
    where: { userId: user.id },
    data: {
      remindersEnabled: parsed.data.remindersEnabled,
      reminderLeadDays: parsed.data.reminderLeadDays,
    },
  });

  revalidatePath("/settings");
  return {
    status: "success",
    message: parsed.data.remindersEnabled
      ? `Reminders are on. We will email you ${parsed.data.reminderLeadDays} day(s) before a money date.`
      : "Reminders are off. Your money dates still appear on the dashboard.",
  };
}

/**
 * Personal Data Protection Act No. 9 of 2022: a verified deletion request must
 * clear the account's data within 30 days. The account is closed immediately
 * and the request is queued; `purgeExpiredRequests` performs the hard delete.
 */
export async function requestAccountDeletionAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const confirmation = String(formData.get("confirm") ?? "").trim();
  if (confirmation !== "DELETE") {
    return {
      status: "error",
      message: "Type DELETE to confirm.",
      errors: { confirm: "Type DELETE exactly" },
    };
  }

  const { purgeAfter, files } = await requestAccountDeletion(user.id);

  await prisma.auditLog.create({
    data: {
      action: "account.deletion_requested",
      entityType: "user",
      meta: JSON.stringify({ purgeAfter: purgeAfter.toISOString(), vaultFiles: files }),
    },
  });

  revalidatePath("/", "layout");
  return {
    status: "success",
    message: `Your account is closed and every record - including ${files} file(s) from your vault - will be deleted by ${purgeAfter.toDateString()}.`,
  };
}

export { ensureCsrfToken };
