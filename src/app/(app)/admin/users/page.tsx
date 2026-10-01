import type { Metadata } from "next";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { RecordForm, type FieldSpec } from "@/components/forms/RecordForm";
import { setUserPlanAction, setUserRoleAction, setUserSuspendedAction } from "../actions";

export const metadata: Metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

/**
 * FR-1.6: the account list.
 *
 * Only account metadata is shown - identifier, plan, role, status and the last
 * sign-in. No income, expenses, goals, letters or documents are queried here, so
 * an admin cannot read anyone's financial content (SRS 2.3).
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await requireAdmin();

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query } },
            { mobile: { contains: query } },
            { profile: { fullName: { contains: query } } },
          ],
        }
      : undefined,
    // Select only the columns this screen is allowed to see.
    select: {
      id: true,
      email: true,
      mobile: true,
      edition: true,
      role: true,
      suspendedAt: true,
      lockedUntil: true,
      lastLoginAt: true,
      createdAt: true,
      profile: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const csrfToken = await ensureCsrfToken();

  const planFields: FieldSpec[] = [
    {
      name: "userId",
      label: "Account",
      type: "select",
      options: users.map((u) => ({ value: u.id, label: labelFor(u) })),
      span: 2,
    },
    {
      name: "edition",
      label: "Plan",
      type: "select",
      options: [
        { value: "basic", label: "Basic" },
        { value: "business", label: "Business" },
      ],
    },
  ];

  const roleFields: FieldSpec[] = [
    {
      name: "userId",
      label: "Account",
      type: "select",
      options: users.map((u) => ({ value: u.id, label: labelFor(u) })),
      span: 2,
    },
    {
      name: "role",
      label: "Role",
      type: "select",
      options: [
        { value: "user", label: "User" },
        { value: "admin", label: "Admin" },
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Accounts"
        description="Search by email, mobile number or name. Admins manage plans and access only - money records and documents are never shown here."
      />

      <form method="get" className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="admin-q" className="mb-1 block text-small font-medium text-text">
            Search accounts
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              id="admin-q"
              name="q"
              defaultValue={query}
              placeholder="email, mobile or name"
              className="min-h-touch w-full rounded-input border border-border bg-surface pl-9 pr-3 text-small text-text"
            />
          </div>
        </div>
        <button type="submit" className="min-h-touch rounded-input bg-accent px-4 py-2 text-small font-medium text-white">
          Search
        </button>
      </form>

      <Card>
        <CardHeader
          title={`${users.length} account${users.length === 1 ? "" : "s"}`}
          subtitle="Newest first"
        />
        <ul className="flex flex-col gap-3">
          {users.map((user) => (
            <li key={user.id}>
              <Card as="div" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-text">{labelFor(user)}</p>
                  <Badge tone={user.edition === "business" ? "accent" : "neutral"}>
                    {user.edition === "business" ? "Business" : "Basic"}
                  </Badge>
                  {user.role === "admin" ? <Badge tone="info">Admin</Badge> : null}
                  {user.suspendedAt ? (
                    <Badge tone="danger">Paused {formatDate(user.suspendedAt)}</Badge>
                  ) : null}
                  {user.lockedUntil && user.lockedUntil > new Date() ? (
                    <Badge tone="warning">Locked out</Badge>
                  ) : null}
                  {user.id === admin.id ? <Badge tone="positive">That is you</Badge> : null}
                </div>
                <p className="text-caption text-text-muted">
                  {user.mobile ? `${user.mobile} · ` : ""}
                  Created {formatDate(user.createdAt)} · Last sign-in{" "}
                  {user.lastLoginAt ? formatDate(user.lastLoginAt) : "never"}
                </p>

                {user.id === admin.id ? null : (
                  <div className="flex flex-col gap-2">
                    <ConfirmDelete
                      action={setUserSuspendedAction}
                      hiddenFields={{
                        _csrf: csrfToken,
                        userId: user.id,
                        suspend: user.suspendedAt ? "false" : "true",
                      }}
                      label={user.suspendedAt ? "Reactivate this account" : "Pause this account"}
                      title={user.suspendedAt ? "Reactivate this account?" : "Pause this account?"}
                      description={
                        user.suspendedAt
                          ? "The account can sign in again immediately."
                          : "The account is signed out everywhere and cannot sign in until you reactivate it."
                      }
                      confirmLabel={user.suspendedAt ? "Reactivate" : "Pause account"}
                      variant="secondary"
                    />
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Change a plan" subtitle="Basic and Business access levels." />
          <RecordForm
            action={setUserPlanAction}
            fields={planFields}
            csrfToken={csrfToken}
            idPrefix="admin-plan"
            submitLabel="Update plan"
          />
        </Card>
        <Card>
          <CardHeader
            title="Change a role"
            subtitle="Admins can manage accounts but never see anyone's money records."
          />
          <RecordForm
            action={setUserRoleAction}
            fields={roleFields}
            csrfToken={csrfToken}
            idPrefix="admin-role"
            submitLabel="Update role"
          />
        </Card>
      </div>
    </div>
  );
}

function labelFor(user: {
  id: string;
  email: string | null;
  mobile: string | null;
  profile: { fullName: string | null } | null;
}): string {
  return user.profile?.fullName ?? user.email ?? user.mobile ?? user.id;
}