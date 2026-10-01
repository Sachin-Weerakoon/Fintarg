"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireAdmin } from "@/lib/guard";
import { FEATURES, isEdition, invalidatePlanFeatureCache, PLANS } from "@/lib/plans";
import type { FormState } from "@/lib/validation";

/**
 * Admin actions (FR-1.6, FR-15.1).
 *
 * Deliberately narrow: these may change an account's edition, plan, role or
 * suspension, and may toggle feature flags. Nothing here reads or writes income,
 * expenses, goals, letters or documents, so an admin can never see a user's
 * financial content (SRS 2.3). Every change writes an `AuditLog` row.
 */

function str(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function setUserPlanAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);
  const admin = await requireAdmin();

  const userId = str(formData, "userId");
  const edition = str(formData, "edition");
  if (!userId || !isEdition(edition)) {
    return { status: "error", message: "Pick a plan first." };
  }
  if (userId === admin.id) {
    return { status: "error", message: "You cannot change your own plan from here." };
  }

  const before = await prisma.user.findUnique({ where: { id: userId }, select: { edition: true, plan: true } });
  if (!before) return { status: "error", message: "That account no longer exists." };

  await prisma.user.update({ where: { id: userId }, data: { edition, plan: edition } });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "admin.plan_changed",
      entityType: "user",
      entityId: userId,
      meta: JSON.stringify({ from: before.edition, to: edition, targetUserId: userId }),
    },
  });

  revalidatePath("/admin");
  return { status: "success", message: "Plan updated." };
}

export async function setUserSuspendedAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const admin = await requireAdmin();

  const userId = str(formData, "userId");
  const suspend = str(formData, "suspend") === "true";
  if (!userId) return;
  if (userId === admin.id) return; // never lock yourself out

  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: suspend ? new Date() : null },
  });
  if (suspend) {
    // A suspended account must lose its live sessions immediately.
    await prisma.session.deleteMany({ where: { userId } });
  }
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: suspend ? "admin.suspended" : "admin.reactivated",
      entityType: "user",
      entityId: userId,
      meta: JSON.stringify({ targetUserId: userId }),
    },
  });

  revalidatePath("/admin");
}

export async function setUserRoleAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);
  const admin = await requireAdmin();

  const userId = str(formData, "userId");
  const role = str(formData, "role");
  if (!userId || (role !== "user" && role !== "admin")) {
    return { status: "error", message: "Pick a role first." };
  }
  if (userId === admin.id) {
    return { status: "error", message: "You cannot change your own role from here." };
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "admin.role_changed",
      entityType: "user",
      entityId: userId,
      meta: JSON.stringify({ role, targetUserId: userId }),
    },
  });

  revalidatePath("/admin");
  return { status: "success", message: "Role updated." };
}

/**
 * FR-15.1: save the plan x feature matrix. A checked box writes an enabled row,
 * an unchecked box writes a disabled row, and a reset clears the overrides so the
 * code defaults in `PLAN_MATRIX` apply again.
 *
 * A plain form action (not `useActionState`), because it drives the whole matrix
 * table rather than a field-level form.
 */
export async function savePlanFeaturesAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const admin = await requireAdmin();

  const changes: { plan: string; feature: string; enabled: boolean }[] = [];
  for (const plan of PLANS) {
    const enabled = formData.getAll(`features.${plan}`).map(String);
    const known = new Set(planFeatureNames());
    for (const feature of known) {
      changes.push({ plan, feature, enabled: enabled.includes(feature) });
    }
  }

  await prisma.$transaction([
    prisma.planFeature.deleteMany({ where: { plan: { in: [...PLANS] } } }),
    prisma.planFeature.createMany({ data: changes }),
    prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "admin.plan_features_saved",
        entityType: "plan",
        meta: JSON.stringify({
          disabled: changes.filter((c) => !c.enabled).map((c) => `${c.plan}:${c.feature}`),
        }),
      },
    }),
  ]);

  // Apply immediately, without a redeploy.
  invalidatePlanFeatureCache();
  revalidatePath("/admin/plans");
  revalidatePath("/", "layout");
}

export async function resetPlanFeaturesAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const admin = await requireAdmin();

  await prisma.$transaction([
    prisma.planFeature.deleteMany({ where: { plan: { in: [...PLANS] } } }),
    prisma.auditLog.create({
      data: { userId: admin.id, action: "admin.plan_features_reset", entityType: "plan" },
    }),
  ]);

  invalidatePlanFeatureCache();
  revalidatePath("/admin/plans");
  revalidatePath("/", "layout");
}

function planFeatureNames(): readonly string[] {
  return FEATURES;
}