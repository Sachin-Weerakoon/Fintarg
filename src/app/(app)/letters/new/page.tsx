import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { formatDate } from "@/lib/dates";
import { can } from "@/lib/plans";
import { letterTemplateByKey, letterTemplatesFor, type LetterTemplate } from "@/lib/letter-templates";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { createLetterAction } from "../actions";

export const metadata = { title: "New letter - Fintarg" };

/** Fields the form handles itself, so they are not repeated as variable inputs. */
const CORE_FIELDS = new Set(["recipientName", "recipientAddress", "signOff"]);

/** Template fields that read better starting from today's date. */
const DATE_FIELDS = new Set(["startDate"]);

export default async function NewLetterPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.edition, "core.letters.personal")) redirect("/");

  const { template: requestedKey } = await searchParams;
  const templates = letterTemplatesFor(user.edition);
  const template = letterTemplateByKey(requestedKey) ?? templates[0];
  if (!template) redirect("/letters");

  const hasBusinessPlan = can(user.edition, "business.letters.company");
  const needsCompany = Boolean(template.businessOnly) && hasBusinessPlan;

  const [businesses, csrfToken] = await Promise.all([
    needsCompany
      ? prisma.business.findMany({
          where: { userId: user.id, deletedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true, address: true },
        })
      : Promise.resolve([]),
    ensureCsrfToken(),
  ]);

  const signerName = user.fullName ?? user.displayName;
  const today = formatDate(new Date());
  const selectedCompany = businesses[0];

  // The body starts as the finished letter, so the user edits real wording.
  const defaultVars: Record<string, string> = {};
  for (const field of template.fields) {
    defaultVars[field.name] =
      field.defaultValue || (DATE_FIELDS.has(field.name) ? today : "");
  }

  const defaultBody = template.render(defaultVars, {
    signerName,
    signerEmail: user.email ?? "",
    companyName: selectedCompany?.name,
    companyAddress: selectedCompany?.address ?? undefined,
    today,
  });

  const fieldFor = (name: string): LetterTemplate["fields"][number] | undefined =>
    template.fields.find((field) => field.name === name);

  const fields: FieldSpec[] = [
    { name: "title", label: "Letter title", type: "text", required: true, defaultValue: template.label, span: 2 },
    {
      name: "recipientName",
      label: fieldFor("recipientName")?.label ?? "Recipient",
      hint: fieldFor("recipientName")?.hint,
      type: "text",
      required: true,
      defaultValue: defaultVars.recipientName,
      span: 2,
    },
    {
      name: "recipientAddress",
      label: fieldFor("recipientAddress")?.label ?? "Recipient address",
      hint: "One line per part of the address",
      type: "textarea",
      rows: 3,
      defaultValue: defaultVars.recipientAddress,
      span: 2,
    },
    ...template.fields
      .filter((field) => !CORE_FIELDS.has(field.name))
      .map<FieldSpec>((field) => ({
        name: field.name,
        label: field.label,
        hint: field.hint,
        type: field.multiline ? "textarea" : "text",
        rows: field.multiline ? 3 : undefined,
        defaultValue: defaultVars[field.name] || undefined,
        span: field.multiline ? 2 : undefined,
      })),
    ...(needsCompany
      ? [
          {
            name: "businessId",
            label: "Company",
            type: "select" as const,
            options: [
              { value: "", label: "No company letterhead" },
              ...businesses.map((business) => ({ value: business.id, label: business.name })),
            ],
            span: 2 as const,
          },
        ]
      : []),
    { name: "signOff", label: "Sign-off", type: "text", defaultValue: defaultVars.signOff },
    {
      name: "body",
      label: "Letter body",
      hint: "This is the finished wording. Edit it so it fits your situation.",
      type: "textarea",
      required: true,
      rows: 10,
      defaultValue: defaultBody,
      span: 2,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="New letter"
        description="Choose a template, fill in the few blanks, and keep the finished letter."
        action={
          <ButtonLink
            href="/letters"
            variant="secondary"
            size="sm"
            icon={<ArrowLeft aria-hidden className="h-4 w-4" />}
          >
            All letters
          </ButtonLink>
        }
      />

      <nav aria-label="Letter templates">
        <ul className="grid gap-2 sm:grid-cols-2">
          {templates.map((option) => {
            const active = option.key === template.key;
            return (
              <li key={option.key}>
                <Link
                  href={`/letters/new?template=${option.key}`}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "flex min-h-touch flex-col gap-0.5 rounded-card border-2 border-accent bg-accent-soft p-3 text-accent"
                      : "flex min-h-touch flex-col gap-0.5 rounded-card border border-border bg-surface p-3 text-text hover:bg-muted"
                  }
                >
                  <span className="text-small font-medium">
                    {option.label}
                    {active ? <span className="sr-only"> (selected)</span> : null}
                  </span>
                  <span className="text-caption text-text-muted">{option.description}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Card>
        <CardHeader
          title={template.label}
          subtitle="Everything below is editable. The body box already holds a full letter."
        />
        <RecordForm
          key={template.key}
          action={createLetterAction}
          fields={fields}
          submitLabel="Save letter"
          pendingLabel="Saving..."
          csrfToken={csrfToken}
          idPrefix={`letter-${template.key}`}
          footer={<input type="hidden" name="templateKey" value={template.key} />}
        />
      </Card>
    </div>
  );
}
