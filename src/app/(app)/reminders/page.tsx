import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BellOff, Check, Clock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { currentMonthKey, formatDate, relativeDayLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { loadUpcomingItems } from "@/lib/reminders/load";
import type { UpcomingItem } from "@/lib/reminders";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { setReminderStatusAction } from "./actions";

export const metadata: Metadata = { title: "Reminders - Fintarg" };
export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  finance_payment: "Payment",
  pawn_interest: "Pawned item",
  loan: "Loan",
  goal: "Savings goal",
  medical: "Medical",
  agreement: "Agreement",
};

/**
 * Reminders centre (FR-4).
 *
 * The list is computed live from the user's own records rather than read from the
 * `Reminder` table, so it is correct the moment a loan or goal is added - a user
 * should not have to wait for the nightly job to see what they just created.
 *
 * Only medical reminders have a persisted row to tick off, so only those offer a
 * button. Everything else is derived and cannot honestly be "done" from here.
 */
export default async function RemindersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [csrfToken, items] = await Promise.all([
    ensureCsrfToken(),
    loadUpcomingItems({
      userId: user.id,
      month: currentMonthKey(),
      edition: user.edition,
      monthsAhead: 2,
    }),
  ]);

  const tickable = items.filter((item) => item.kind === "medical");
  const derived = items.filter((item) => item.kind !== "medical");

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Reminders"
        description="Every money date we can see, worked out from your own records."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing coming up"
          description="Add a payment, a loan, a pawned item or a savings goal and the dates will appear here."
        />
      ) : null}

      {tickable.length > 0 ? (
        <section aria-labelledby="tickable-heading">
          <h2 id="tickable-heading" className="mb-3 text-h2 font-medium text-text">
            You can tick these off
          </h2>
          <ul className="flex flex-col gap-3">
            {tickable.map((item) => (
              <li key={item.id}>
                <ReminderCard item={item} csrfToken={csrfToken} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {derived.length > 0 ? (
        <section aria-labelledby="derived-heading">
          <h2 id="derived-heading" className="mb-3 text-h2 font-medium text-text">
            Worked out from your records
          </h2>
          <p className="mb-3 text-small text-text-muted">
            These come from the payment, loan, pawn, goal and agreement you have already saved. Change
            the record and this list changes with it.
          </p>
          <ul className="flex flex-col gap-3">
            {derived.map((item) => (
              <li key={item.id}>
                <ReminderCard item={item} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AlertBanner
        level="info"
        title="How reminders reach you"
        message={
          user.email
            ? "We email you before each date. You choose how many days ahead in Settings."
            : "This account has no email address, so we text you instead. You choose how many days ahead in Settings."
        }
      />
    </div>
  );
}

const URGENCY: Record<UpcomingItem["urgency"], { label: string; tone: "danger" | "warning" | "neutral" | "positive" }> = {
  overdue: { label: "Overdue", tone: "danger" },
  urgent: { label: "Soon", tone: "warning" },
  soon: { label: "Coming up", tone: "neutral" },
  later: { label: "Later", tone: "positive" },
};

function ReminderCard({ item, csrfToken }: { item: UpcomingItem; csrfToken?: string }) {
  const urgency = URGENCY[item.urgency];

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={urgency.tone} icon={<Clock aria-hidden className="h-3.5 w-3.5" />}>
              {urgency.label}
            </Badge>
            <span className="text-caption text-text-muted">{KIND_LABELS[item.kind] ?? item.kind}</span>
          </div>

          <p className="mt-2 text-small font-medium text-text">{item.title}</p>
          <p className="mt-0.5 text-small text-text-muted">{item.detail}</p>

          <p className="tabular mt-1.5 text-small text-text-muted">
            {formatDate(item.dueDate)} · {relativeDayLabel(item.dueDate)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.amountCents ? (
            <p className="tabular text-small font-medium text-text">{formatMoney(item.amountCents)}</p>
          ) : null}
          {csrfToken ? (
            <form action={setReminderStatusAction}>
              <input type="hidden" name="_csrf" value={csrfToken} />
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="status" value="done" />
              <button
                type="submit"
                className="inline-flex min-h-touch items-center gap-1.5 rounded-input border border-border bg-surface px-3 py-1.5 text-small text-text hover:bg-muted"
              >
                <Check aria-hidden className="h-4 w-4" />
                Mark done
              </button>
            </form>
          ) : item.href ? (
            <Link
              href={item.href}
              className="inline-flex min-h-touch items-center gap-1.5 rounded-input border border-border bg-surface px-3 py-1.5 text-small text-text hover:bg-muted"
            >
              Open
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}