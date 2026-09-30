import { redirect } from "next/navigation";
import { CheckCircle2, Gem } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db";
import { formatDate, toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { pawnMonthlyInterestCents, type PawnedItemInput } from "@/lib/finance/analysis";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { buttonClass } from "@/components/ui/Button";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { ReminderChip } from "@/components/financial/ReminderChip";
import {
  createPawnedItemAction,
  deletePawnedItemAction,
  markPawnInterestPaidAction,
} from "../actions";

export default async function PawnedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const csrf = await ensureCsrfToken();
  const rows = await prisma.pawnedItem.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: [{ nextInterestDueDate: "asc" }, { createdAt: "desc" }],
  });

  const items: PawnedItemInput[] = rows.map((row) => ({
    id: row.id,
    description: row.description,
    amountReceivedCents: row.amountReceivedCents,
    interestRatePct: row.interestRatePct,
    monthlyInterestCents: row.monthlyInterestCents,
    nextInterestDueDate: row.nextInterestDueDate,
    redemptionDate: row.redemptionDate,
  }));

  const interestById = new Map(items.map((item) => [item.id, pawnMonthlyInterestCents(item)]));
  const interestTotal = items.reduce((total, item) => total + (interestById.get(item.id) ?? 0), 0);

  const fields: FieldSpec[] = [
    { name: "description", label: "What did you pledge?", type: "text", required: true, placeholder: "e.g. Gold chain" },
    { name: "amountReceived", label: "How much did you receive?", type: "amount", required: true, placeholder: "100000" },
    { name: "interestRatePct", label: "Interest rate a year", type: "number", min: "0", max: "100", step: "0.01", hint: "Annual rate" },
    { name: "monthlyInterest", label: "Interest each month", type: "amount", hint: "Leave empty to calculate it" },
    { name: "nextInterestDueDate", label: "Next interest due", type: "date", hint: "We will remind you before it" },
    { name: "redemptionDate", label: "Date to take it back", type: "date", hint: "When you plan to redeem it" },
    { name: "notes", label: "Notes", type: "textarea", rows: 3 },
  ];

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Pawned items"
        description="Things you pledged to a pawnshop. Interest falls due every month, and the item is yours again once it is paid for."
      />

      <Card>
        <CardHeader title="Add a pawned item" subtitle="The amount you received is what the shop gave you for the item." />
        <RecordForm
          action={createPawnedItemAction}
          fields={fields}
          submitLabel="Add item"
          pendingLabel="Adding..."
          csrfToken={csrf}
          idPrefix="pawned"
        />
      </Card>

      <Card tone={items.length ? "warning" : "default"}>
        <p className="text-small font-medium text-text-muted">Pawn interest due this month</p>
        <p className="tabular mt-1 text-display font-semibold text-warning">{formatMoney(interestTotal)}</p>
        <p className="mt-1 text-small text-text-muted">
          {items.length
            ? `Across ${items.length} item(s). This comes out of what is left each month.`
            : "Nothing is pledged at the moment."}
        </p>
      </Card>

      <section aria-labelledby="pawned-list-heading" className="flex flex-col gap-3">
        <h2 id="pawned-list-heading" className="text-h2 font-medium text-text">
          Your pledged items
        </h2>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Gem aria-hidden className="h-6 w-6" />}
            title="Nothing is pledged"
            description="Add an item when you pawn something, so you always know when the next interest is due and when you can take it back."
          />
        ) : (
          <ul aria-label="Pawned items" className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id}>
                <Card as="div" className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-warning-soft text-warning">
                        <Gem className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-text">{row.description}</p>
                        <p className="mt-0.5 text-small text-text-muted">
                          Received {formatMoney(row.amountReceivedCents)} at {row.interestRatePct}% a year
                          {row.notes ? ` · ${row.notes}` : ""}
                        </p>
                        <p className="mt-1 text-small text-text-muted">
                          {formatMoney(interestById.get(row.id) ?? 0)} interest this month
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <form action={markPawnInterestPaidAction} method="post">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="_csrf" value={csrf} />
                        <button
                          type="submit"
                          className={buttonClass({ variant: "secondary", size: "sm" })}
                          title="Records that you paid this month's interest and moves the due date on by one month"
                        >
                          <CheckCircle2 aria-hidden className="h-4 w-4" />
                          Interest paid
                        </button>
                      </form>
                      <ConfirmDelete
                        action={deletePawnedItemAction}
                        hiddenFields={{ id: row.id, _csrf: csrf }}
                        label="Delete"
                        title="Remove this pawned item?"
                        description="It stops counting towards your monthly interest. Your history keeps a record of it."
                        variant="ghost"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    {row.nextInterestDueDate ? (
                      <ReminderChip date={row.nextInterestDueDate} prefix="Next interest" />
                    ) : (
                      <p className="text-caption text-text-muted">
                        No next interest date yet. Add one to get a reminder.
                      </p>
                    )}
                    {row.redemptionDate ? (
                      <ReminderChip date={row.redemptionDate} prefix="Take it back by" />
                    ) : null}
                    {row.redemptionDate && row.nextInterestDueDate ? (
                      <p className="text-caption text-text-muted">
                        Pledged on {formatDate(row.createdAt)}.
                      </p>
                    ) : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
