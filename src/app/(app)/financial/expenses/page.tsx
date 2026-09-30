import { redirect } from "next/navigation";
import { Filter, Receipt, Stethoscope, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db";
import {
  currentMonthKey,
  formatDate,
  monthRange,
  toDateInputValue,
  type MonthKey,
} from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { loadAnalysis } from "@/lib/finance/load";
import { EXPENSE_CATEGORIES } from "@/lib/validation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { buttonClass } from "@/components/ui/Button";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { MonthNav } from "@/components/financial/MonthNav";
import { ShareBar } from "@/components/financial/ShareBar";
import { createExpenseAction, deleteExpenseAction } from "../actions";

const SELECT_CLASS =
  "min-h-touch rounded-input border border-border bg-surface px-3 py-2 text-body text-text focus:border-accent";

type SearchParams = Promise<{ month?: string; category?: string }>;

function readMonth(value: string | string[] | undefined): MonthKey {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonthKey();
}

function readCategory(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const csrf = await ensureCsrfToken();
  const month = readMonth(params.month);
  const activeCategory = readCategory(params.category);
  const { start, end } = monthRange(month);

  const [userCategories, { analysis }] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    loadAnalysis(user.id, month),
  ]);

  const categoryNames = Array.from(
    new Map(
      [...EXPENSE_CATEGORIES, ...userCategories.map((category) => category.name)].map((name) => [
        name.toLowerCase(),
        name,
      ]),
    ).values(),
  );

  const rows = await prisma.expense.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      date: { gte: start, lte: end },
      ...(activeCategory ? { categoryName: activeCategory } : {}),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const today = new Date();
  const todayKey = toDateInputValue(today);
  const todayTotal = rows
    .filter((row) => toDateInputValue(row.date) === todayKey)
    .reduce((total, row) => total + row.amountCents, 0);

  const days = new Map<number, typeof rows>();
  for (const row of rows) {
    const day = row.date.getDate();
    days.set(day, [...(days.get(day) ?? []), row]);
  }
  const dayGroups = Array.from(days.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([day, entries]) => ({
      day,
      totalCents: entries.reduce((total, entry) => total + entry.amountCents, 0),
      entries,
    }));

  const filteredTotal = rows.reduce((total, row) => total + row.amountCents, 0);

  const fields: FieldSpec[] = [
    { name: "date", label: "Date", type: "date", required: true, defaultValue: todayKey },
    { name: "amount", label: "How much did you spend?", type: "amount", required: true, placeholder: "1500" },
    {
      name: "categoryName",
      label: "What was it for?",
      type: "select",
      defaultValue: categoryNames[0],
      options: categoryNames.map((name) => ({ value: name, label: name })),
    },
    { name: "note", label: "Note", type: "text", hint: "For example: rice and milk" },
    { name: "recurring", label: "This happens every month", type: "checkbox", hint: "Include it in next month's forecast" },
    { name: "isPersonal", label: "This was for me", type: "checkbox", hint: "Count this against my monthly personal plan" },
    { name: "isMedical", label: "This was a medical cost", type: "checkbox", hint: "Count this as a medical expense" },
  ];

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Expenses"
        description="What your money goes on, day by day. Pick a month to look back at what you spent."
      />

      <Card>
        <CardHeader title="Add an expense" subtitle="One entry per purchase or bill." />
        <RecordForm
          action={createExpenseAction}
          fields={fields}
          submitLabel="Add expense"
          pendingLabel="Saving..."
          csrfToken={csrf}
          idPrefix="expense"
        />
      </Card>

      <section aria-labelledby="expense-totals-heading" className="flex flex-col gap-3">
        <h2 id="expense-totals-heading" className="text-h2 font-medium text-text">
          Where you are
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          <li>
            <Card as="div" className="h-full">
              <p className="text-caption font-medium uppercase tracking-wide text-text-muted">Spent today</p>
              <p className="tabular mt-1 text-h1 font-semibold text-text">{formatMoney(todayTotal)}</p>
            </Card>
          </li>
          <li>
            <Card as="div" className="h-full">
              <p className="text-caption font-medium uppercase tracking-wide text-text-muted">This month</p>
              <p className="tabular mt-1 text-h1 font-semibold text-text">
                {formatMoney(analysis.monthToDateSpentCents)}
              </p>
            </Card>
          </li>
          <li>
            <Card as="div" className="h-full">
              <p className="text-caption font-medium uppercase tracking-wide text-text-muted">A day on average</p>
              <p className="tabular mt-1 text-h1 font-semibold text-text">
                {formatMoney(analysis.averageDailySpendCents)}
              </p>
            </Card>
          </li>
        </ul>
        {activeCategory ? (
          <p className="text-small text-text-muted">
            Showing only <span className="font-medium text-text">{activeCategory}</span> ·{" "}
            {formatMoney(filteredTotal)} in total.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="expense-where-heading" className="flex flex-col gap-3">
        <h2 id="expense-where-heading" className="text-h2 font-medium text-text">
          What the money went on
        </h2>
        {analysis.categoryTotals.length === 0 ? (
          <p className="text-small text-text-muted">Nothing recorded this month yet, so there is nothing to split.</p>
        ) : (
          <ul aria-label="Spending by category" className="flex flex-col gap-4">
            {analysis.categoryTotals.map((entry) => (
              <ShareBar
                key={entry.category}
                label={entry.category}
                amountCents={entry.amountCents}
                sharePct={entry.sharePct}
                totalCents={analysis.monthToDateSpentCents}
                tone={entry.sharePct >= 50 ? "warning" : "accent"}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="expense-list-heading" className="flex flex-col gap-3">
        <h2 id="expense-list-heading" className="text-h2 font-medium text-text">
          Day by day
        </h2>

        <MonthNav month={month} basePath="/financial/expenses" category={activeCategory || undefined} />

        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="month" value={month} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="expense-category-filter" className="text-small font-medium text-text">
              Filter by category
            </label>
            <select
              id="expense-category-filter"
              name="category"
              defaultValue={activeCategory}
              className={SELECT_CLASS}
            >
              <option value="">All categories</option>
              {categoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonClass({ size: "md", variant: "secondary" })}>
            <Filter aria-hidden className="h-4 w-4" />
            Filter
          </button>
          {activeCategory ? (
            <Link
              href={`/financial/expenses?month=${month}`}
              className={buttonClass({ size: "md", variant: "ghost" })}
            >
              <X aria-hidden className="h-4 w-4" />
              Clear filter
            </Link>
          ) : null}
        </form>

        {activeCategory ? (
          <p className="text-small text-text-muted">
            Filter on: <span className="font-medium text-text">{activeCategory}</span>
          </p>
        ) : null}

        {dayGroups.length === 0 ? (
          <EmptyState
            icon={<Receipt aria-hidden className="h-6 w-6" />}
            title="No expenses in this month"
            description="Nothing has been recorded here yet. Add an entry with the form above, or move to another month using the arrows."
          />
        ) : (
          <ul aria-label={`Expenses for ${month}`} className="flex flex-col gap-3">
            {dayGroups.map((group) => (
              <li key={group.day}>
                <Card as="div" className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
                    <h3 className="text-small font-medium text-text">
                      Day {group.day} <span className="text-text-muted">· {formatDate(group.entries[0].date)}</span>
                    </h3>
                    <p className="tabular text-small font-semibold text-text">
                      {formatMoney(group.totalCents)}
                    </p>
                  </div>

                  <ul aria-label={`Expenses on day ${group.day}`} className="flex flex-col gap-2">
                    {group.entries.map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-small text-text">
                            <span className="font-medium">{entry.categoryName}</span>
                            {entry.isPersonal ? (
                              <Badge tone="accent" icon={<Sparkles aria-hidden className="h-3 w-3" />}>
                                Personal
                              </Badge>
                            ) : null}
                            {entry.isMedical ? (
                              <Badge tone="info" icon={<Stethoscope aria-hidden className="h-3 w-3" />}>
                                Medical
                              </Badge>
                            ) : null}
                            {entry.recurring ? <Badge tone="neutral">Every month</Badge> : null}
                          </p>
                          {entry.note ? <p className="text-caption text-text-muted">{entry.note}</p> : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <span className="tabular text-small font-semibold text-text">
                            {formatMoney(entry.amountCents)}
                          </span>
                          <ConfirmDelete
                            action={deleteExpenseAction}
                            hiddenFields={{ id: entry.id, _csrf: csrf }}
                            label="Delete"
                            title="Remove this expense?"
                            description="It stops counting towards your totals. Your history keeps a record of it."
                            variant="ghost"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
