import type { Metadata } from "next";
import { requireAdmin } from "@/lib/guard";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHomePage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Admin"
        description="Account management. Admins can change plans and access only - no one's money records or documents are reachable from here."
      />
      <ul className="flex flex-col gap-2 text-small">
        <li>
          <a href="/admin/users" className="font-medium text-accent hover:underline">
            Accounts
          </a>{" "}
          <span className="text-text-muted">- search, change plan or role, pause and reactivate.</span>
        </li>
        <li>
          <a href="/admin/plans" className="font-medium text-accent hover:underline">
            Feature flags
          </a>{" "}
          <span className="text-text-muted">- turn a feature off for a plan without a deploy.</span>
        </li>
      </ul>
    </div>
  );
}