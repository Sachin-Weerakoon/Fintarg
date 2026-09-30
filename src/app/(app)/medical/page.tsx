import { redirect } from "next/navigation";
import { HeartPulse, Lock, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { can } from "@/lib/plans";
import { loadAnalysis } from "@/lib/finance/load";
import { formatMoney } from "@/lib/money";
import {
  currentMonthKey,
  daysUntil,
  formatMonthLabel,
  monthRange,
  toDateInputValue,
  toMonthKey,
} from "@/lib/dates";
import { PageHeader } from "@/components/layout/PageHeader";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MedicalRecordFormCard } from "@/components/medical/MedicalRecordFormCard";
import { MedicalReminders } from "@/components/medical/MedicalReminders";
import {
  MedicalHistory,
  groupTotal,
  type MedicalMonthGroup,
  type MedicalRecordItem,
} from "@/components/medical/MedicalHistory";

/** Medical section (FR-12): records, reminders and a plain spending summary. */
export default async function MedicalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!can(user.edition, "core.medical")) {
    return (
      <>
        <PageHeader title="Medical" description="Your medical records, in one private place." />
        <AlertBanner
          level="info"
          title="Not part of your plan yet"
          message="The medical section is not included in your current plan."
          actionLabel="See plans"
          actionHref="/settings#plan"
        />
      </>
    );
  }

  const monthKey = currentMonthKey();
  const { start: monthStart, end: monthEnd } = monthRange(monthKey);
  const yearStart = new Date(monthStart.getFullYear(), 0, 1);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [monthSum, yearSum, records, reminders, { analysis }] = await Promise.all([
    // Medical spending only: the analysis engine reports *all* living expenses.
    prisma.expense.aggregate({
      where: {
        userId: user.id,
        isMedical: true,
        deletedAt: null,
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: {
        userId: user.id,
        isMedical: true,
        deletedAt: null,
        date: { gte: yearStart, lte: startOfToday },
      },
      _sum: { amountCents: true },
    }),
    prisma.medicalRecord.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.reminder.findMany({
      where: { userId: user.id, kind: "medical", status: "pending", dueDate: { gte: startOfToday } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    loadAnalysis(user.id, monthKey),
  ]);

  const csrfToken = await ensureCsrfToken();

  const monthCents = monthSum._sum.amountCents ?? 0;
  const yearCents = yearSum._sum.amountCents ?? 0;
  const daysLeft = Math.max(0, daysUntil(monthEnd, startOfToday));

  const groups: MedicalMonthGroup[] = [];
  for (const record of records) {
    const item: MedicalRecordItem = {
      id: record.id,
      kind: record.kind,
      date: record.date,
      title: record.title,
      provider: record.provider,
      amountCents: record.amountCents,
      notes: record.notes,
    };
    const key = toMonthKey(record.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.records.push(item);
    } else {
      groups.push({ key, label: formatMonthLabel(key), records: [item], totalCents: 0 });
    }
  }
  for (const group of groups) group.totalCents = groupTotal(group.records);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Medical"
        description="What you paid, what you were told, and what you need to take next."
      />

      <AlertBanner
        level="info"
        title="Private to you"
        message="Your medical records are private to you. Only you can open them."
      />

      <Card>
        <CardHeader
          title="Medical spending"
          subtitle="What health costs have taken out of your money."
          action={<Badge tone="info">Includes every medical record you saved</Badge>}
        />

        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-card border border-border bg-surface p-3">
            <dt className="text-caption font-medium uppercase tracking-wide text-text-muted">
              This month
            </dt>
            <dd className="tabular mt-1 text-h2 font-semibold text-text">
              {formatMoney(monthCents)}
            </dd>
          </div>
          <div className="rounded-card border border-border bg-surface p-3">
            <dt className="text-caption font-medium uppercase tracking-wide text-text-muted">
              This year
            </dt>
            <dd className="tabular mt-1 text-h2 font-semibold text-text">
              {formatMoney(yearCents)}
            </dd>
          </div>
        </dl>

        <p className="mt-3 flex items-start gap-2 text-small text-text-muted">
          <Wallet aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Medical spending already appears in your monthly analysis, so your net position is
            correct. This month you finish at{" "}
            <span className="tabular font-medium text-text">
              {formatMoney(analysis.netPositionCents)}
            </span>
            {analysis.isShortfall ? " short." : "."}
          </span>
        </p>

        <p className="mt-1 text-caption text-text-muted">
          {daysLeft === 0
            ? "This month ends today."
            : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in this month.`}
        </p>
      </Card>

      <MedicalRecordFormCard csrfToken={csrfToken} today={toDateInputValue(startOfToday)} />

      <MedicalReminders
        reminders={reminders.map((reminder) => ({
          id: reminder.id,
          title: reminder.title,
          dueDate: reminder.dueDate,
        }))}
        csrfToken={csrfToken}
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={<HeartPulse className="h-6 w-6" />}
          title="No medical records yet"
          description="Add a record above to keep track of what you paid, and we will remind you about doses and appointments."
        />
      ) : (
        <MedicalHistory groups={groups} csrfToken={csrfToken} />
      )}

      <p className="flex items-center justify-center gap-1.5 text-caption text-text-muted">
        <Lock aria-hidden className="h-3.5 w-3.5" />
        Only you can see these records. We never share them.
      </p>
    </div>
  );
}
