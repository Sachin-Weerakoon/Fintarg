"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCsrf } from "@/lib/auth/csrf";
import { can } from "@/lib/plans";
import { ensureReadableOnWhite } from "@/lib/theme";
import { parseAmountToCents } from "@/lib/money";
import { agreementSchema, businessSchema, flattenErrors, type FormState } from "@/lib/validation";

/**
 * BR-7: Business-only features are gated here as well as in the navigation.
 * A Basic user who guesses the URL gets a clear explanation, never a form.
 */
async function requireBusinessUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.edition, "business.advanced")) redirect("/settings#plan");
  return user;
}

export async function createBusinessAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);
  const user = await requireBusinessUser();

  const parsed = businessSchema.safeParse({
    name: formData.get("name"),
    regNumber: formData.get("regNumber") ?? "",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    accentColor: formData.get("accentColor") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: flattenErrors(parsed.error) };
  }

  await prisma.business.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      regNumber: parsed.data.regNumber,
      address: parsed.data.address,
      phone: parsed.data.phone,
      email: parsed.data.email,
      accentColor: parsed.data.accentColor ? ensureReadableOnWhite(parsed.data.accentColor) : null,
    },
  });

  revalidatePath("/advanced");
  return { status: "success", message: `${parsed.data.name} was added.` };
}

export async function updateBusinessAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);
  const user = await requireBusinessUser();

  const id = String(formData.get("id") ?? "");
  const existing = await prisma.business.findFirst({ where: { id, userId: user.id, deletedAt: null } });
  if (!existing) return { status: "error", message: "That company could not be found." };

  const parsed = businessSchema.safeParse({
    name: formData.get("name"),
    regNumber: formData.get("regNumber") ?? "",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    accentColor: formData.get("accentColor") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: flattenErrors(parsed.error) };
  }

  await prisma.business.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name,
      regNumber: parsed.data.regNumber,
      address: parsed.data.address,
      phone: parsed.data.phone,
      email: parsed.data.email,
      accentColor: parsed.data.accentColor ? ensureReadableOnWhite(parsed.data.accentColor) : null,
    },
  });

  revalidatePath("/advanced");
  return { status: "success", message: "Company details updated." };
}

export async function deleteBusinessAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireBusinessUser();
  const id = String(formData.get("id") ?? "");
  await prisma.business.updateMany({ where: { id, userId: user.id }, data: { deletedAt: new Date() } });
  revalidatePath("/advanced");
}

export async function createAgreementAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);
  const user = await requireBusinessUser();

  const parsed = agreementSchema.safeParse({
    title: formData.get("title"),
    otherParty: formData.get("otherParty"),
    businessId: formData.get("businessId") ?? "",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    value: formData.get("value") ?? "",
    summary: formData.get("summary") ?? "",
    status: formData.get("status") ?? "draft",
  });

  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: flattenErrors(parsed.error) };
  }

  const valueCents = parseAmountToCents(parsed.data.value ?? "");

  // The agreement form is not a trust boundary: businessId arrives from the
  // browser. Resolving it against this account stops an agreement being
  // attached to another tenant's company, which would then expose that
  // company's contact details through the agreement list.
  let businessId: string | null = null;
  if (parsed.data.businessId) {
    const owned = await prisma.business.findFirst({
      where: { id: parsed.data.businessId, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!owned) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        errors: { businessId: "Choose one of your companies" },
      };
    }
    businessId = owned.id;
  }

  await prisma.agreement.create({
    data: {
      userId: user.id,
      businessId,
      title: parsed.data.title,
      otherParty: parsed.data.otherParty,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      valueCents,
      summary: parsed.data.summary,
      status: parsed.data.status,
    },
  });

  revalidatePath("/advanced");
  revalidatePath("/");
  return { status: "success", message: "Agreement saved." };
}

export async function updateAgreementStatusAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireBusinessUser();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["draft", "active", "expired"].includes(status)) return;

  await prisma.agreement.updateMany({ where: { id, userId: user.id }, data: { status } });
  revalidatePath("/advanced");
}

export async function deleteAgreementAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireBusinessUser();
  const id = String(formData.get("id") ?? "");
  await prisma.agreement.updateMany({ where: { id, userId: user.id }, data: { deletedAt: new Date() } });
  revalidatePath("/advanced");
}
