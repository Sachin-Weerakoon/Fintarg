"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCsrf } from "@/lib/auth/csrf";
import { can } from "@/lib/plans";
import { ensureReadableOnWhite } from "@/lib/theme";
import { parseAmountToCents } from "@/lib/money";
import { agreementSchema, companySchema, flattenErrors, type FormState } from "@/lib/validation";

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

export async function createCompanyAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);
  const user = await requireBusinessUser();

  const parsed = companySchema.safeParse({
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

  await prisma.company.create({
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

export async function updateCompanyAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);
  const user = await requireBusinessUser();

  const id = String(formData.get("id") ?? "");
  const existing = await prisma.company.findFirst({ where: { id, userId: user.id, deletedAt: null } });
  if (!existing) return { status: "error", message: "That company could not be found." };

  const parsed = companySchema.safeParse({
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

  await prisma.company.update({
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

export async function deleteCompanyAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const user = await requireBusinessUser();
  const id = String(formData.get("id") ?? "");
  await prisma.company.updateMany({ where: { id, userId: user.id }, data: { deletedAt: new Date() } });
  revalidatePath("/advanced");
}

export async function createAgreementAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);
  const user = await requireBusinessUser();

  const parsed = agreementSchema.safeParse({
    title: formData.get("title"),
    otherParty: formData.get("otherParty"),
    companyId: formData.get("companyId") ?? "",
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

  await prisma.agreement.create({
    data: {
      userId: user.id,
      companyId: parsed.data.companyId || null,
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
