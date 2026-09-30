"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCsrf } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/plans";
import { letterTemplateByKey } from "@/lib/letter-templates";
import { flattenErrors, letterSchema, type FormState } from "@/lib/validation";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function revalidateLetters(letterId?: string): void {
  revalidatePath("/letters");
  if (letterId) revalidatePath(`/letters/${letterId}`);
}

/** FR-10: store a letter so it can be read again and downloaded as a PDF. */
export async function createLetterAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.edition, "core.letters.personal")) redirect("/");

  const parsed = letterSchema.safeParse({
    templateKey: text(formData, "templateKey"),
    companyId: text(formData, "companyId"),
    title: text(formData, "title"),
    recipientName: text(formData, "recipientName"),
    recipientAddress: text(formData, "recipientAddress"),
    body: text(formData, "body"),
    signOff: text(formData, "signOff"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: flattenErrors(parsed.error),
    };
  }

  const data = parsed.data;
  const template = letterTemplateByKey(data.templateKey);
  if (!template) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: { templateKey: "Choose a letter template" },
    };
  }

  if (template.businessOnly && !can(user.edition, "business.letters.company")) {
    return {
      status: "error",
      message: "Company letters are part of the Business edition.",
      errors: { templateKey: "Company letters need a Business plan" },
    };
  }

  // A company is only attached when it is the user's own, undeleted company.
  let companyId: string | null = null;
  if (data.companyId) {
    const company = await prisma.company.findFirst({
      where: { id: data.companyId, userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!company) {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        errors: { companyId: "Choose one of your companies" },
      };
    }
    companyId = company.id;
  }

  const variables: Record<string, string> = { templateKey: data.templateKey };
  for (const field of template.fields) {
    variables[field.name] = text(formData, field.name);
  }
  variables.recipientName = data.recipientName;
  variables.signOff = data.signOff ?? "";

  await prisma.letter.create({
    data: {
      userId: user.id,
      companyId,
      templateKey: data.templateKey,
      title: data.title,
      variablesJson: JSON.stringify(variables),
      bodyText: data.body,
    },
  });

  revalidateLetters();
  redirect("/letters");
}

/** Destructive: remove a letter, always behind the confirm dialog. */
export async function deleteLetterAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = text(formData, "id");
  if (!id) return;

  await prisma.letter.updateMany({
    where: { id, userId: user.id },
    data: { deletedAt: new Date() },
  });

  revalidateLetters(id);
}
