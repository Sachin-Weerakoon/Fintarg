import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { isValidHex } from "@/lib/theme";
import { letterFileSlug, renderLetterPdf } from "@/lib/pdf/letters";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * FR-10: download a letter as a PDF. The letter is loaded scoped to the current
 * user, so one user can never reach another's file, and the PDF is produced in
 * memory - nothing is written to disk.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ letterId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Sign in to download this letter.", { status: 401 });
  }

  const { letterId } = await params;
  const letter = await prisma.letter.findFirst({
    where: { id: letterId, userId: user.id, deletedAt: null },
    include: {
      company: {
        select: { name: true, address: true, phone: true, email: true, regNumber: true, accentColor: true },
      },
    },
  });

  if (!letter) {
    return new Response("That letter does not exist.", { status: 404 });
  }

  const variables = readVariables(letter.variablesJson);
  const signerName = user.fullName ?? user.displayName;
  const recipientName = variables.recipientName?.trim() || letter.title;
  const recipientAddress = variables.recipientAddress?.trim() || undefined;
  const companyAccent = letter.company?.accentColor ?? "";
  const accentHex = isValidHex(companyAccent) ? companyAccent : user.themeAccent;

  const buffer = renderLetterPdf({
    title: letter.title,
    body: letter.bodyText?.trim() || "",
    recipientName,
    recipientAddress,
    signerName,
    signerEmail: user.email ?? undefined,
    todayLabel: formatDate(new Date()),
    company: letter.company
      ? {
          name: letter.company.name,
          address: letter.company.address ?? undefined,
          phone: letter.company.phone ?? undefined,
          email: letter.company.email ?? undefined,
          regNumber: letter.company.regNumber ?? undefined,
        }
      : null,
    accentHex,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fintarg-letter-${letterFileSlug(letter.title)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

function readVariables(json: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}
