import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { formatDate } from "@/lib/dates";
import { can } from "@/lib/plans";
import { letterTemplateByKey } from "@/lib/letter-templates";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { deleteLetterAction } from "../actions";

export const metadata = { title: "Letter - Fintarg" };

export default async function LetterDetailPage({ params }: { params: Promise<{ letterId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.edition, "core.letters.personal")) redirect("/");

  const { letterId } = await params;
  const [letter, csrfToken] = await Promise.all([
    prisma.letter.findFirst({
      where: { id: letterId, userId: user.id, deletedAt: null },
      include: { business: { select: { name: true, regNumber: true } } },
    }),
    ensureCsrfToken(),
  ]);
  if (!letter) notFound();

  const template = letterTemplateByKey(letter.templateKey);
  const body = letter.bodyText?.trim() || "This letter has no body text yet.";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={letter.title}
        description={`${template?.label ?? "Letter"} · written on ${formatDate(letter.createdAt)}`}
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

      <Card>
        <CardHeader
          title="Your letter"
          subtitle={letter.business ? `On ${letter.business.name} letterhead` : "On your own letterhead"}
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ButtonLink
                href={`/letters/${letter.id}/download`}
                size="sm"
                icon={<FileText aria-hidden className="h-4 w-4" />}
              >
                Download PDF
              </ButtonLink>
              <ConfirmDelete
                action={deleteLetterAction}
                hiddenFields={{ id: letter.id, _csrf: csrfToken }}
                label="Delete"
                title={`Delete "${letter.title}"?`}
                description="The letter is removed from your account."
              />
            </div>
          }
        />

        <div className="flex flex-col gap-3">
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{template?.label ?? "Letter"}</Badge>
            {letter.business?.regNumber ? (
              <Badge tone="neutral">Reg. No. {letter.business.regNumber}</Badge>
            ) : null}
          </p>

          <div
            aria-label={`Letter: ${letter.title}`}
            className="rounded-card border border-border bg-bg p-card"
          >
            <p className="whitespace-pre-wrap text-body leading-relaxed text-text">{body}</p>
          </div>

          <p className="text-caption text-text-muted">
            Need a change?{" "}
            <Link
              href="/letters/new"
              className="font-medium text-accent underline"
            >
              Write a new letter
            </Link>{" "}
            from the same template and keep both.
          </p>
        </div>
      </Card>
    </div>
  );
}
