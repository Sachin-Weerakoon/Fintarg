import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { planLabel } from "@/lib/plans";
import { MobileNav, Sidebar, SystemThemeWatcher } from "@/components/layout/Nav";
import { SignOutButton } from "@/components/layout/SignOutButton";

/**
 * Authenticated shell: desktop left sidebar, mobile bottom navigation, and a
 * page header. Every protected page lives under this layout, so authentication
 * and data isolation (BR-8) are enforced in exactly one place.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const displayName = user.fullName ?? user.email.split("@")[0];
  const label = planLabel(user.edition);

  return (
    <div className="min-h-dvh lg:flex">
      <SystemThemeWatcher />

      <a href="#main" className="skip-link text-small font-medium text-accent">
        Skip to main content
      </a>

      <aside className="no-scrollbar sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto border-r border-border bg-surface lg:block">
        <Sidebar edition={user.edition} userName={displayName} planLabel={label} />
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
          <SignOutButton />
        </header>

        <main id="main" className="flex-1 px-content-x py-4 pb-nav lg:pb-section">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      <MobileNav edition={user.edition} userName={displayName} planLabel={label} />
    </div>
  );
}
