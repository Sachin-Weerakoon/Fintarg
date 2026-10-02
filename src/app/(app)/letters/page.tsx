import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { formatDate } from "@/lib/dates";
import { can } from "@/lib/plans";
import { letterTemplateByKey } from "@/lib/letter-templates";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, SectionTitle } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { EmptyState } from "@/components/ui/EmptyState";
import { deleteLetterAction } from "./actions";

export const metadata = { title: "Letters - Fintarg" };

function LetterList({
  letters,
  csrfToken,
  label,
}: {
  letters: {
    id: string;
    title: string;
    templateKey: string;
    createdAt: Date;
    business: { id: string; name: string } | null;
  }[];
  csrfToken: string;
  label: string;
}) {
  return (
    <ul aria-label={label} className="card divide-y divide-border">
      {letters.map((letter) => {
        const template = letterTemplateByKey(letter.templateKey);
        return (
          <li key={letter.id} className="flex flex-col gap-3 p-card sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-body font-medium text-text">{letter.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-text-muted">
                <span>{template?.label ?? "Letter"}</span>
                <span aria-hidden>&middot;</span>
                <span className="tabular">Created {formatDate(letter.createdAt)}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ButtonLink
                href={`/letters/${letter.id}/download`}
                variant="secondary"
                size="sm"
                icon={<FileText aria-hidden className="h-4 w-4" />}
              >
                Download PDF
              </ButtonLink>
              <Link
                href={`/letters/${letter.id}`}
                className="inline-flex min-h-touch items-center rounded-pill px-3 text-small font-medium text-accent hover:underline"
              >
                Read
                <span className="sr-only"> {letter.title}</span>
              </Link>
              <ConfirmDelete
                action={deleteLetterAction}
                hiddenFields={{ id: letter.id, _csrf: csrfToken }}
                label="Delete"
                title={`Delete "${letter.title}"?`}
                description="The letter is removed from your account."
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function LettersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.edition, "core.letters.personal")) redirect("/");

  const hasBusinessPlan = can(user.edition, "business.letters.company");

  const [letters, csrfToken, businesses] = await Promise.all([
    prisma.letter.findMany({
      where: { userId: user.id, deletedAt: null },
      include: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    ensureCsrfToken(),
    hasBusinessPlan
      ? prisma.business.findMany({
          where: { userId: user.id, deletedAt: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const businessIds = new Set(businesses.map((business) => business.id));
  const personalLetters = letters.filter((letter) => !letter.businessId);
  const companyLetters = letters.filter((letter) => letter.businessId !== null);
  // Letters whose company was removed or renamed still belong to the user.
  const orphaned = companyLetters.filter((letter) => !letter.businessId || !businessIds.has(letter.businessId));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Letters"
        description="Write a letter from a template, keep it here, and download it as a PDF."
        action={
          <ButtonLink href="/letters/new" size="md" icon={<Plus aria-hidden className="h-4 w-4" />}>
            New letter
          </ButtonLink>
        }
      />

      {letters.length === 0 ? (
        <EmptyState
          icon={<FileText aria-hidden className="h-6 w-6" />}
          title="No letters yet"
          description="A letter is ready-made wording for things like asking a bank to confirm your account details. Pick a template, edit the words, and download the result as a PDF."
          action={
            <ButtonLink href="/letters/new" size="md">
              Write your first letter
            </ButtonLink>
          }
        />
      ) : null}

      {personalLetters.length > 0 ? (
        <section aria-label="Your letters">
          <SectionTitle>Your letters</SectionTitle>
          <LetterList letters={personalLetters} csrfToken={csrfToken} label="Your letters" />
        </section>
      ) : null}

      {hasBusinessPlan && companyLetters.length > 0 ? (
        <section aria-label="Company letters">
          <SectionTitle hint="Letters written on a company letterhead.">Company letters</SectionTitle>
          <div className="flex flex-col gap-4">
            {businesses.map((business) => {
              const group = companyLetters.filter((letter) => letter.businessId === business.id);
              if (group.length === 0) return null;
              return (
                <Card key={business.id}>
                  <p className="mb-3 flex items-center gap-2 text-small font-medium text-text">
                    {business.name}
                    <Badge tone="accent">
                      {group.length} {group.length === 1 ? "letter" : "letters"}
                    </Badge>
                  </p>
                  <LetterList
                    letters={group}
                    csrfToken={csrfToken}
                    label={`Letters from ${business.name}`}
                  />
                </Card>
              );
            })}
            {orphaned.length > 0 ? (
              <LetterList letters={orphaned} csrfToken={csrfToken} label="Other company letters" />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
