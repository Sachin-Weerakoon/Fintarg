"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertCsrf } from "@/lib/auth/csrf";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteEncryptedFile, newStoredName, writeEncryptedFile } from "@/lib/storage";
import {
  documentSchema,
  fileField,
  flattenErrors,
  type FieldErrors,
  type FormState,
} from "@/lib/validation";

/**
 * Document vault server actions (FR-9).
 *
 * Files are encrypted with `writeEncryptedFile` *before* any database row
 * exists, and the encrypted copy is removed again if the write fails, so the
 * vault never keeps an orphan file the user cannot see or delete. Every query
 * filters by `userId` (BR-8).
 */

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

export async function uploadDocumentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);
  const userId = await requireUserId();

  const errors: FieldErrors = {};

  const parsed = documentSchema.safeParse({
    category: str(formData, "category"),
    label: str(formData, "label"),
    note: str(formData, "note"),
    sensitivity: str(formData, "sensitivity"),
  });
  if (!parsed.success) Object.assign(errors, flattenErrors(parsed.error));

  const upload = formData.get("file");
  const fileResult = fileField.safeParse(upload);
  if (!fileResult.success) {
    for (const issue of fileResult.error.issues) errors.file ??= issue.message;
  }

  if (Object.keys(errors).length > 0 || !parsed.success || !fileResult.success) {
    return fail("Check the file details and try again.", errors);
  }

  const data = parsed.data;
  const file = fileResult.data;

  // The stored name is opaque: the user's real file name never reaches the disk.
  const storedName = newStoredName();
  await writeEncryptedFile(userId, storedName, Buffer.from(await file.arrayBuffer()));

  try {
    await prisma.document.create({
      data: {
        userId,
        category: data.category,
        label: data.label,
        originalName: file.name,
        storedName,
        mimeType: file.type,
        sizeBytes: file.size,
        note: data.note ?? null,
        sensitivity: data.sensitivity,
      },
    });
  } catch (error) {
    await deleteEncryptedFile(userId, storedName);
    throw error;
  }

  revalidatePath("/vault");
  return { status: "success", message: `${data.label} uploaded and encrypted.` };
}

export async function deleteDocumentAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const userId = await requireUserId();
  const id = str(formData, "id");
  if (!id) return;

  const document = await prisma.document.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true, storedName: true, label: true, category: true },
  });
  if (!document) return;

  await prisma.document.updateMany({
    where: { id: document.id, userId },
    data: { deletedAt: new Date() },
  });
  await deleteEncryptedFile(userId, document.storedName);

  await prisma.auditLog.create({
    data: {
      userId,
      action: "document.delete",
      entityType: "Document",
      entityId: document.id,
      meta: JSON.stringify({ category: document.category, label: document.label }),
    },
  });

  revalidatePath("/vault");
}
