import { redirect } from "next/navigation";
import { FolderLock } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { can } from "@/lib/plans";
import { PageHeader } from "@/components/layout/PageHeader";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Badge } from "@/components/ui/Badge";
import { UploadCard } from "@/components/vault/UploadCard";
import { CategorySection } from "@/components/vault/CategorySection";

/** Document vault (FR-9): encrypted uploads grouped into plain categories. */

const CATEGORIES = [
  {
    key: "profile",
    title: "Profile picture",
    description: "The photo other people see next to your name.",
  },
  {
    key: "cv",
    title: "CV and related",
    description: "Your CV, cover letters and job applications.",
  },
  {
    key: "nic",
    title: "NIC - front and back",
    description: "Scans of both sides of your National Identity Card.",
  },
  {
    key: "bank",
    title: "Bank documents",
    description: "Statements, account letters and loan papers.",
  },
  {
    key: "medical",
    title: "Medical",
    description: "Reports, prescriptions and claim forms.",
  },
  {
    key: "other",
    title: "Other",
    description: "Anything else you want to keep safe.",
  },
  {
    key: "letter",
    title: "Letters you generated",
    description: "PDFs of letters you created in the Letter Generator.",
  },
  {
    key: "agreement",
    title: "Agreements",
    description: "The signed copies of your business agreements.",
  },
] as const;

export default async function VaultPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!can(user.edition, "core.vault")) {
    return (
      <>
        <PageHeader title="Documents" description="Only you can see these files." />
        <AlertBanner
          level="info"
          title="Not part of your plan yet"
          message="The document vault is not included in your current plan."
          actionLabel="See plans"
          actionHref="/settings#plan"
        />
      </>
    );
  }

  const documents = await prisma.document.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      category: { in: CATEGORIES.map((category) => category.key) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      category: true,
      label: true,
      originalName: true,
      sizeBytes: true,
      note: true,
      sensitivity: true,
      createdAt: true,
    },
  });

  const csrfToken = await ensureCsrfToken();
  const totalBytes = documents.reduce((total, document) => total + document.sizeBytes, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Documents"
        description="Only you can see these files. They are stored encrypted."
        action={
          <Badge tone="info">
            {documents.length === 1 ? "1 file" : `${documents.length} files`} kept safe
          </Badge>
        }
      />

      <AlertBanner
        level="info"
        title="Strongest protection where it matters"
        message="NIC, bank and medical files get the strongest protection. If you delete your account, everything here is removed within 30 days, as required by Sri Lanka's Personal Data Protection Act No. 9 of 2022."
      />

      <UploadCard csrfToken={csrfToken} />

      {CATEGORIES.map((category) => (
        <CategorySection
          key={category.key}
          title={category.title}
          description={category.description}
          category={category.key}
          documents={documents.filter((document) => document.category === category.key)}
          csrfToken={csrfToken}
        />
      ))}

      <p className="flex items-center justify-center gap-1.5 text-caption text-text-muted">
        <FolderLock aria-hidden className="h-3.5 w-3.5" />
        {documents.length === 0
          ? "Your vault is empty. Your first upload takes a moment to encrypt."
          : `You are using ${(totalBytes / (1024 * 1024)).toFixed(2)} MB of your vault.`}
      </p>
    </div>
  );
}
