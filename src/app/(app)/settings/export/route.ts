import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCsrf } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * NFR-7 / PDPA No. 9 of 2022: "Download my data".
 *
 * Returns one JSON file with every record the signed-in user owns. POST rather
 * than GET so a CSRF token is required and a link prefetcher cannot trigger a
 * download of someone's data.
 *
 * Document *bytes* are deliberately excluded - only metadata (label, category,
 * size, dates) is included, because the file itself stays in the encrypted vault.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const formData = await request.formData();
  try {
    await assertCsrf(formData);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid csrf token" }, { status: 403 });
  }

  const userId = user.id;

  // Every query is scoped to this one user id. No admin path reaches this route.
  const [
    profile,
    contacts,
    incomes,
    expenses,
    categories,
    financePayments,
    loans,
    pawnedItems,
    goals,
    plans,
    companies,
    letters,
    agreements,
    medical,
    documents,
    reminders,
  ] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.contact.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.expenseCategory.findMany({ where: { userId } }),
    prisma.financePayment.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.pawnedItem.findMany({ where: { userId } }),
    prisma.savingsGoal.findMany({ where: { userId }, include: { contributions: true } }),
    prisma.personalSpendingPlan.findMany({ where: { userId } }),
    prisma.company.findMany({ where: { userId } }),
    prisma.letter.findMany({ where: { userId } }),
    prisma.agreement.findMany({ where: { userId } }),
    prisma.medicalRecord.findMany({ where: { userId } }),
    prisma.document.findMany({ where: { userId } }),
    prisma.reminder.findMany({ where: { userId } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    format: "fintarg-data-export/1",
    note:
      "Every record stored for your account. Vault document file contents are not included - " +
      "only their metadata - because those files stay encrypted in the vault.",
    account: {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      edition: user.edition,
      plan: user.plan,
      role: user.role,
      ...(await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, consentAt: true, consentVersion: true },
      })),
    },
    profile,
    contacts,
    incomes,
    expenses,
    categories,
    financePayments,
    loans,
    pawnedItems,
    goals,
    personalSpendingPlans: plans,
    companies,
    letters,
    agreements,
    medicalRecords: medical,
    documents: documents.map((document) => ({
      // Metadata only - never the stored name or the file bytes.
      id: document.id,
      category: document.category,
      label: document.label,
      originalName: document.originalName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      sensitivity: document.sensitivity,
      note: document.note,
      createdAt: document.createdAt,
      deletedAt: document.deletedAt,
    })),
    reminders,
  };

  const filename = `fintarg-data-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}