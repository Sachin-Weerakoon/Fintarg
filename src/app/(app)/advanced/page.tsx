import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Briefcase, FileSignature, Plus, Search } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { prisma } from "@/lib/db";
import { can } from "@/lib/plans";
import { formatDate, todayInput, daysUntil, relativeDayLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { EmptyState } from "@/components/ui/EmptyState";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import {
  createAgreementAction,
  createCompanyAction,
  deleteAgreementAction,
  deleteCompanyAction,
  updateAgreementStatusAction,
} from "@/app/(app)/advanced/actions";

export const metadata: Metadata = { title: "Advanced" };
export const dynamic = "force-dynamic";

const STATUS_LABEL = { draft: "Draft", active: "Active", expired: "Expired" } as const;

export default async function AdvancedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // BR-7: the route itself refuses Basic users, not just the menu item.
  if (!can(user.edition, "business.advanced")) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Advanced" />
        <AlertBanner
          level="info"
          title="This part is for the Business plan"
          message="Company profiles, company letters and agreements are part of the Business plan. Everything you need for your own money is already available on the Basic plan."
          actionLabel="See plans"
          actionHref="/settings#plan"
        />
      </div>
    );
  }

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = params.status ?? "";

  const [companies, agreements] = await Promise.all([
    prisma.company.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: { createdAt: "asc" } }),
    prisma.agreement.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        ...(query ? { OR: [{ title: { contains: query } }, { otherParty: { contains: query } }] } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { endDate: "asc" },
    }),
  ]);

  const csrfToken = await ensureCsrfToken();
  const today = new Date();

  const companyFields: FieldSpec[] = [
    { name: "name", label: "Company name", type: "text", required: true, span: 2 },
    { name: "regNumber", label: "Registration number", type: "text" },
    { name: "accentColor", label: "Letter colour", type: "text", hint: "A colour like #1d4ed8, used on your letters." },
    { name: "phone", label: "Phone", type: "text" },
    { name: "email", label: "Email", type: "text" },
    { name: "address", label: "Address", type: "textarea", rows: 3, span: 2 },
  ];

  const agreementFields: FieldSpec[] = [
    { name: "title", label: "Agreement title", type: "text", required: true, span: 2 },
    { name: "otherParty", label: "Other party", type: "text", required: true },
    {
      name: "companyId",
      label: "Company",
      type: "select",
      defaultValue: companies[0]?.id ?? "",
      options: [
        { value: "", label: "Not company related" },
        ...companies.map((company) => ({ value: company.id, label: company.name })),
      ],
    },
    { name: "startDate", label: "Start date", type: "date", required: true, defaultValue: todayInput() },
    { name: "endDate", label: "End date", type: "date", required: true },
    { name: "value", label: "Value", type: "amount", hint: "The money involved, if there is one." },
    {
      name: "status",
      label: "Status",
      type: "select",
      defaultValue: "draft",
      options: [
        { value: "draft", label: "Draft" },
        { value: "active", label: "Active" },
        { value: "expired", label: "Expired" },
      ],
    },
    { name: "summary", label: "Summary of terms", type: "textarea", rows: 5, span: 2, hint: "The main points, in your own words." },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Advanced"
        description="Your companies and the agreements you are part of."
        action={
          <ButtonLink href="/letters/new?template=company" variant="secondary" icon={<FileSignature aria-hidden className="h-4 w-4" />}>
            New company letter
          </ButtonLink>
        }
      />

      <Card>
        <CardHeader
          title="Companies"
          subtitle="Your letterhead details, used on the letters you generate"
          action={<Badge tone="accent">Business plan</Badge>}
        />

        {companies.length > 0 ? (
          <ul className="mb-4 flex flex-col gap-2">
            {companies.map((company) => (
              <li key={company.id} className="rounded-input border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-small font-medium text-text">
                      <span
                        aria-hidden
                        className="h-3 w-3 shrink-0 rounded-pill"
                        style={{ backgroundColor: company.accentColor ?? "rgb(var(--c-accent))" }}
                      />
                      {company.name}
                    </p>
                    {company.regNumber ? (
                      <p className="text-caption text-text-muted">Reg. {company.regNumber}</p>
                    ) : null}
                    {company.address ? <p className="mt-1 text-caption text-text-muted">{company.address}</p> : null}
                    {company.phone || company.email ? (
                      <p className="text-caption text-text-muted">
                        {[company.phone, company.email].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ButtonLink
                      href={`/letters/new?template=company&companyId=${company.id}`}
                      variant="secondary"
                      size="sm"
                      icon={<FileSignature aria-hidden className="h-4 w-4" />}
                    >
                      Write a letter
                    </ButtonLink>
                    <ConfirmDelete
                      action={deleteCompanyAction}
                      hiddenFields={{ id: company.id, _csrf: csrfToken }}
                      label="Remove"
                      title={`Remove ${company.name}?`}
                      description="Letters you already generated stay in your vault. You can add the company again later."
                      confirmLabel="Yes, remove"
                      variant="secondary"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-4">
            <EmptyState
              compact
              icon={<Briefcase aria-hidden className="h-5 w-5" />}
              title="No companies yet"
              description="Add your company once and every letter you generate will carry your details."
            />
          </div>
        )}

        <RecordForm
          action={createCompanyAction}
          fields={companyFields}
          csrfToken={csrfToken}
          idPrefix="company"
          submitLabel="Add company"
          pendingLabel="Adding..."
        />
      </Card>

      <Card>
        <CardHeader
          title="Agreements"
          subtitle="Title, the other party, dates, value and the main terms"
        />

        <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="agreement-search" className="text-small font-medium text-text">
              Search
            </label>
            <div className="relative mt-1">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                id="agreement-search"
                name="q"
                defaultValue={query}
                placeholder="Title or other party"
                className="min-h-touch w-full rounded-input border border-border bg-surface pl-9 pr-3 text-body text-text placeholder:text-text-muted/70"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <label htmlFor="agreement-status" className="text-small font-medium text-text">
              Status
            </label>
            <select
              id="agreement-status"
              name="status"
              defaultValue={status}
              className="mt-1 min-h-touch w-full rounded-input border border-border bg-surface px-3 text-body text-text"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex min-h-touch items-center justify-center rounded-pill border border-border bg-surface px-5 text-body font-medium text-text transition-colors hover:bg-muted"
          >
            Filter
          </button>
          {query || status ? (
            <Link
              href="/advanced"
              className="inline-flex min-h-touch items-center justify-center rounded-pill px-4 text-small font-medium text-accent hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {agreements.length === 0 ? (
          <div className="mb-4">
            <EmptyState
              compact
              icon={<FileSignature aria-hidden className="h-5 w-5" />}
              title={query || status ? "No agreements match that" : "No agreements yet"}
              description={
                query || status
                  ? "Try a different search, or clear the filter to see all of them."
                  : "Add the agreements you are part of so you get a reminder before they end."
              }
            />
          </div>
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {agreements.map((agreement) => {
              const daysLeft = agreement.endDate ? daysUntil(agreement.endDate, today) : null;
              const endingSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 30;
              return (
                <li key={agreement.id} className="rounded-input border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-small font-medium text-text">{agreement.title}</p>
                      <p className="text-caption text-text-muted">With {agreement.otherParty}</p>
                      <p className="mt-1 text-caption text-text-muted">
                        {formatDate(agreement.startDate)} to {agreement.endDate ? formatDate(agreement.endDate) : "open ended"}
                        {agreement.valueCents ? ` · ${formatMoney(agreement.valueCents)}` : ""}
                      </p>
                      {agreement.summary ? (
                        <p className="mt-1 line-clamp-2 text-caption text-text-muted">{agreement.summary}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge
                        tone={
                          agreement.status === "active"
                            ? "positive"
                            : agreement.status === "expired"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {STATUS_LABEL[agreement.status as keyof typeof STATUS_LABEL] ?? agreement.status}
                      </Badge>
                      {endingSoon && agreement.endDate ? (
                        <Badge tone="warning">Ends {relativeDayLabel(agreement.endDate)}</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusButton
                      action={updateAgreementStatusAction}
                      csrfToken={csrfToken}
                      id={agreement.id}
                      status="active"
                      label="Mark active"
                      current={agreement.status === "active"}
                    />
                    <StatusButton
                      action={updateAgreementStatusAction}
                      csrfToken={csrfToken}
                      id={agreement.id}
                      status="expired"
                      label="Mark expired"
                      current={agreement.status === "expired"}
                    />
                    <span className="ml-auto">
                      <ConfirmDelete
                        action={deleteAgreementAction}
                        hiddenFields={{ id: agreement.id, _csrf: csrfToken }}
                        label="Delete"
                        title={`Delete ${agreement.title}?`}
                        description="This agreement will be removed from your list. Your uploaded file stays in the vault."
                        confirmLabel="Yes, delete"
                      />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <RecordForm
          action={createAgreementAction}
          fields={agreementFields}
          csrfToken={csrfToken}
          idPrefix="agreement"
          submitLabel="Add agreement"
          pendingLabel="Saving..."
          footer={
            <p className="flex items-center gap-2 text-caption text-text-muted">
              <Plus aria-hidden className="h-3.5 w-3.5" />
              Upload the signed file itself in the document vault, under Other, and note the agreement title.
            </p>
          }
        />
      </Card>
    </div>
  );
}

function StatusButton({
  action,
  csrfToken,
  id,
  status,
  label,
  current,
}: {
  action: (formData: FormData) => Promise<void>;
  csrfToken: string;
  id: string;
  status: string;
  label: string;
  current: boolean;
}) {
  if (current) {
    return (
      <span className="inline-flex min-h-touch items-center rounded-pill bg-muted px-4 text-small font-medium text-text-muted">
        {label}
      </span>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="_csrf" value={csrfToken} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="inline-flex min-h-touch items-center rounded-pill border border-border bg-surface px-4 text-small font-medium text-text transition-colors hover:bg-muted"
      >
        {label}
      </button>
    </form>
  );
}
