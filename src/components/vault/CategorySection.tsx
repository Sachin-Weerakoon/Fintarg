import Link from "next/link";
import { Download, FileText, Eye, Lock, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { formatDate } from "@/lib/dates";
import { deleteDocumentAction } from "@/app/(app)/vault/actions";

export interface VaultDocument {
  id: string;
  category: string;
  label: string;
  originalName: string;
  sizeBytes: number;
  note: string | null;
  sensitivity: string;
  createdAt: Date;
}

const SENSITIVITY: Record<string, { label: string; tone: BadgeTone; icon: React.ReactNode }> = {
  standard: { label: "Standard", tone: "neutral", icon: <FileText aria-hidden className="h-3.5 w-3.5" /> },
  sensitive: { label: "Sensitive", tone: "warning", icon: <Eye aria-hidden className="h-3.5 w-3.5" /> },
  restricted: { label: "Restricted", tone: "danger", icon: <Lock aria-hidden className="h-3.5 w-3.5" /> },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CategorySection({
  title,
  description,
  category,
  documents,
  csrfToken,
}: {
  title: string;
  description: string;
  category: string;
  documents: VaultDocument[];
  csrfToken: string;
}) {
  const isProfile = category === "profile";

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h2 font-medium text-text">{title}</h2>
          <p className="mt-1 text-small text-text-muted">{description}</p>
        </div>
        <Badge tone={documents.length > 0 ? "accent" : "neutral"}>
          {documents.length === 1 ? "1 file" : `${documents.length} files`}
        </Badge>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          compact
          icon={<ShieldCheck className="h-5 w-5" />}
          title={`Nothing in ${title.toLowerCase()} yet`}
          description="Use the form above to add a file to this group."
        />
      ) : (
        <>
          {isProfile ? (
            <p className="mb-3 flex items-start gap-2 text-small text-text-muted">
              <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>This is the file shown as your profile picture.</span>
            </p>
          ) : null}

          <ul className="flex flex-col gap-3">
            {documents.map((document) => {
              const sensitivity = SENSITIVITY[document.sensitivity] ?? SENSITIVITY.standard;

              return (
                <li
                  key={document.id}
                  className="rounded-card border border-border bg-surface p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-body font-medium text-text">{document.label}</p>
                      <p className="mt-0.5 break-words text-caption text-text-muted">
                        {document.originalName} · {formatFileSize(document.sizeBytes)} · added{" "}
                        {formatDate(document.createdAt)}
                      </p>
                    </div>
                    <Badge tone={sensitivity.tone} icon={sensitivity.icon}>
                      {sensitivity.label}
                    </Badge>
                  </div>

                  {document.note ? (
                    <p className="mt-2 text-small text-text-muted">{document.note}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/vault/${document.id}/download`}
                      className={buttonClass({ variant: "secondary", size: "sm" })}
                      aria-label={`Download ${document.label}`}
                    >
                      <Download aria-hidden className="h-4 w-4" />
                      Download
                    </Link>
                    <ConfirmDelete
                      action={deleteDocumentAction}
                      hiddenFields={{ id: document.id, _csrf: csrfToken }}
                      label="Delete"
                      title="Delete this file?"
                      description="The file is removed from our servers. This cannot be undone."
                      confirmLabel="Yes, delete"
                      variant="ghost"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
