import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { planLabel } from "@/lib/plans";
import { MobileNav, Sidebar, SystemThemeWatcher } from "@/components/layout/Nav";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { VerifyEmailButton } from "@/components/forms/VerifyEmailButton";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { getLocale } from "@/lib/i18n/server";
import { getWorkspace } from "@/lib/workspace";
import { hasBusinessLedger, type UserModeValue } from "@/lib/mode";
import { Home, Building2, Layers } from "lucide-react";

/**
 * Authenticated shell: desktop left sidebar, mobile bottom navigation, and a
 * page header. Every protected page lives under this layout, so authentication
 * and data isolation (BR-8) are enforced in exactly one place.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const displayName = user.displayName;
  const label = planLabel(user.edition);
  const locale = await getLocale();

  // Determine if user has business ledger access
  const hasBiz = hasBusinessLedger(user.mode as UserModeValue);
  const workspace = hasBiz ? await getWorkspace() : null;

  // Only needed when the banner below actually renders.
  const csrfToken = user.needsVerification ? await ensureCsrfToken() : "";

  return (
    <div className="min-h-dvh lg:flex">
      <SystemThemeWatcher />

      <a href="#main" className="skip-link text-small font-medium text-accent">
        Skip to main content
      </a>

      <aside className="no-scrollbar sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto border-r border-border bg-[#1d3951] text-white lg:block">
        <Sidebar edition={user.edition} features={user.features} role={user.role} locale={locale} userName={displayName} planLabel={label} mode={user.mode as UserModeValue} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 py-2 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-accent text-caption font-semibold text-accent-contrast lg:hidden"
            >
              F
            </span>
            <p className="truncate text-small font-medium text-text">
              {displayName}
              <span className="ml-2 rounded-pill bg-muted px-2 py-0.5 text-caption text-text-muted">
                {label}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasBiz && workspace && (
              <WorkspaceSwitcherServer mode={user.mode as UserModeValue} workspace={workspace} />
            )}
            <SignOutButton />
          </div>
        </header>

        <main id="main" className="flex-1 px-content-x py-4 pb-nav lg:pb-section">
          {user.needsVerification ? (
            <div className="mx-auto mb-4 w-full max-w-5xl">
              <AlertBanner
                level="warning"
                title="Confirm your email address"
                message="We have sent a verification link. It keeps reminders and your data export going to an address you actually own."
                action={<VerifyEmailButton csrfToken={csrfToken} />}
              />
            </div>
          ) : null}
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      <MobileNav edition={user.edition} features={user.features} role={user.role} locale={locale} userName={displayName} planLabel={label} mode={user.mode as UserModeValue} />
    </div>
  );
}

async function WorkspaceSwitcherServer({
  mode,
  workspace,
}: {
  mode: UserModeValue;
  workspace: Awaited<ReturnType<typeof getWorkspace>>;
}) {
  const { WorkspaceSwitcher } = await import("@/components/layout/WorkspaceSwitcher");
  const { getOwnedBusinesses } = await import("@/lib/business/ownership");
  const { requireUser } = await import("@/lib/auth/session");

  const user = await requireUser();
  const businesses = await getOwnedBusinesses(user.id);

  const options = [
    { value: "personal", label: "Personal", icon: <Home className="h-5 w-5" />, description: "Your personal finances" },
    ...(businesses.length > 0
      ? [
          { value: "allBusinesses", label: "All businesses", icon: <Building2 className="h-5 w-5" />, description: "Combined view of all businesses" },
          ...businesses.map((b) => ({
            value: `b:${b.id}`,
            label: b.name,
            icon: <Building2 className="h-5 w-5" />,
            description: `View ${b.name} only`,
          })),
          ...(mode === "both"
            ? [{ value: "combined", label: "Combined", icon: <Layers className="h-5 w-5" />, description: "Personal + business together" }]
            : []),
        ]
      : []),
  ];

  return (
    <WorkspaceSwitcher
      current={workspace}
      options={options}
      onChange={async (v) => {
        const { setWorkspaceAction } = await import("@/lib/workspace");
        const fd = new FormData();
        fd.append("workspace", v);
        await setWorkspaceAction(null, fd);
      }}
    />
  );
}
