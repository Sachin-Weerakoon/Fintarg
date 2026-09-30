import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { readEncryptedFile } from "@/lib/storage";

/**
 * Download a stored file (FR-9).
 *
 * The document is looked up with the signed-in user in the `where` clause, so a
 * missing row, another user's row and a deleted row are all answered with the
 * same 404 - a caller can never learn that someone else's file exists. Decrypted
 * bytes never touch the disk and are never cached.
 */

function extensionOf(originalName: string): string {
  const dot = originalName.lastIndexOf(".");
  if (dot <= 0) return "";
  return originalName.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, "");
}

/** Keep only letters, digits, dots, spaces and dashes in the offered file name. */
function safeFileName(label: string, extension: string): string {
  const base = label.replace(/[^A-Za-z0-9. -]/g, "").replace(/^\.+/, "").replace(/\.+$/, "").trim();
  return `${base || "document"}${extension}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const { documentId } = await params;

  const user = await getCurrentUser();
  if (!user) return new Response("Not found", { status: 404 });

  const document = await prisma.document.findFirst({
    where: { id: documentId, userId: user.id, deletedAt: null },
    select: { id: true, label: true, originalName: true, storedName: true, mimeType: true },
  });
  if (!document) return new Response("Not found", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readEncryptedFile(user.id, document.storedName);
  } catch {
    return new Response("This file could not be opened. Try uploading it again.", { status: 500 });
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${safeFileName(document.label, extensionOf(document.originalName))}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
