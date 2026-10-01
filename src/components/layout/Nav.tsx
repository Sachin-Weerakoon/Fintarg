"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  BOTTOM_BAR_KEYS,
  navItemsFor,
  secondaryItems,
  type NavItem,
} from "@/lib/navigation";
import { cn } from "@/lib/cn";
import type { Edition, Feature } from "@/lib/plans";
import { useClickOutside } from "@/components/ui/useClickOutside";

function isActive(pathname: string, href: string, key: string) {
  if (key === "home") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop left sidebar (UIX-001 navigation). */
export function Sidebar({
  edition,
  features,
  role,
  userName,
  planLabel,
  onNavigate,
}: {
  edition: Edition;
  features?: Feature[] | null;
  role?: "user" | "admin";
  userName: string;
  planLabel: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navItemsFor(edition, { resolvedFeatures: features, role });

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/" className="flex items-center gap-2.5 px-2" onClick={onNavigate}>
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-pill bg-accent text-small font-semibold text-accent-contrast"
        >
          F
        </span>
        <span className="min-w-0">
          <span className="block truncate text-h2 font-semibold text-text">Fintarg</span>
          <span className="block truncate text-caption text-text-muted">{userName}</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex-1">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isActive(pathname, item.href, item.key);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-touch items-center gap-3 rounded-input px-3 py-2.5 text-body transition-colors",
                    active
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-text hover:bg-muted",
                  )}
                >
                  <Icon aria-hidden className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {active ? <span className="sr-only">(current page)</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="rounded-card border border-border bg-muted p-3">
        <p className="text-caption font-medium uppercase tracking-wide text-text-muted">Your plan</p>
        <p className="mt-0.5 text-body font-medium text-text">{planLabel}</p>
        <Link
          href="/settings#plan"
          className="mt-2 inline-flex min-h-touch items-center text-small font-medium text-accent hover:underline"
          onClick={onNavigate}
        >
          Manage plan
        </Link>
      </div>
    </div>
  );
}

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <span
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-pill transition-colors",
        active ? "bg-accent text-accent-contrast" : "text-text-muted",
      )}
    >
      <Icon aria-hidden className="h-5 w-5" />
    </span>
  );
}

/** Mobile bottom navigation: Home | Analysis | Goals | More (UIX-001). */
export function MobileNav({ edition, features, role, userName, planLabel }: { edition: Edition; features?: Feature[] | null; role?: "user" | "admin"; userName: string; planLabel: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = navItemsFor(edition, { resolvedFeatures: features, role });
  const barItems = BOTTOM_BAR_KEYS.map((key) => items.find((item) => item.key === key)).filter(
    (item): item is NavItem => Boolean(item),
  );
  const overflow = secondaryItems(edition, { resolvedFeatures: features, role });
  const more = items.find((item) => item.key === "letters");
  const moreActive = more ? isActive(pathname, more.href, more.key) : false;

  const ref = useClickOutside<HTMLDivElement>(() => setMoreOpen(false), moreOpen);

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" aria-hidden onClick={() => setMoreOpen(false)} />
      ) : null}

      <div
        ref={ref}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur safe-bottom lg:hidden"
      >
        {moreOpen ? (
          <div
            id="more-menu"
            className="max-h-[70vh] overflow-y-auto border-b border-border px-4 py-3 animate-slide-down"
          >
            <p className="px-1 pb-2 text-caption font-medium uppercase tracking-wide text-text-muted">
              All sections
            </p>
            <ul className="grid gap-1">
              {items.map((item) => {
                const active = isActive(pathname, item.href, item.key);
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-touch items-center gap-3 rounded-input px-2 py-2",
                        active ? "bg-accent-soft text-accent" : "text-text hover:bg-muted",
                      )}
                    >
                      <Icon aria-hidden className="h-5 w-5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-medium">{item.label}</span>
                        <span className="block truncate text-caption text-text-muted">
                          {item.description}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {overflow.length === 0 ? null : (
              <p className="sr-only">{overflow.length} more sections available in this menu.</p>
            )}
          </div>
        ) : null}

        <nav aria-label="Main" className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1">
          {barItems.map((item) => {
            const active = isActive(pathname, item.href, item.key);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-touch flex-1 flex-col items-center gap-0.5 rounded-pill px-1 py-1.5 text-caption",
                  active ? "text-accent" : "text-text-muted",
                )}
              >
                <NavIcon item={item} active={active} />
                <span className="font-medium">{item.label}</span>
                {active ? <span className="sr-only">(current page)</span> : null}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls="more-menu"
            className="flex min-h-touch flex-1 flex-col items-center gap-0.5 rounded-pill px-1 py-1.5 text-caption text-text-muted"
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-pill",
                moreActive || moreOpen ? "bg-accent text-accent-contrast" : "text-text-muted",
              )}
            >
              <MoreHorizontal aria-hidden className="h-5 w-5" />
            </span>
            <span className="font-medium">More</span>
          </button>
        </nav>
      </div>
    </>
  );
}

/** Follow the system colour scheme when the user chose "system". */
export function SystemThemeWatcher() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-theme") !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.setAttribute("data-theme", media.matches ? "dark" : "light");
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return null;
}

