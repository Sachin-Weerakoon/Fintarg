"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  bottomBarKeysFor,
  navItemsFor,
  moreSheetItemsFor,
  type ResolvedNavItem,
  isActive as isActiveNav,
} from "@/lib/navigation";
import { cn } from "@/lib/cn";
import type { Edition, Feature } from "@/lib/plans";
import type { Locale } from "@/lib/i18n";
import { useClickOutside } from "@/components/ui/useClickOutside";
import type { UserModeValue } from "@/lib/mode";

/** Desktop left sidebar (UIX-001 navigation). */
export function Sidebar({
  edition,
  features,
  role,
  locale,
  userName,
  planLabel,
  mode,
  onNavigate,
}: {
  edition: Edition;
  features?: Feature[] | null;
  role?: "user" | "admin";
  locale?: Locale;
  userName: string;
  planLabel: string;
  mode?: UserModeValue;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navItemsFor(edition, { resolvedFeatures: features, role, locale, mode });

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/" className="flex items-center gap-2.5 px-2 text-white" onClick={onNavigate}>
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#39c4d8] text-small font-semibold text-[#0d2033]"
        >
          F
        </span>
        <span className="min-w-0 text-left">
          <span className="block truncate text-h2 font-semibold text-white">Fintarg</span>
          <span className="block truncate text-caption text-white/70">{planLabel}</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex-1 pt-2">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const active = isActiveNav(pathname, item);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-touch items-center gap-3 rounded-xl px-3 py-2.5 text-body transition-colors",
                    active
                      ? "bg-[#e9f1f4] font-medium text-[#132b3d]"
                      : "text-white/80 hover:bg-white/5",
                  )}
                >
                  <Icon aria-hidden className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {active ? <span className="sr-only">(current page)</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto flex items-center gap-2 rounded-full bg-white/10 px-2 py-2 text-white/90 shadow-inner shadow-black/10">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#39c4d8] text-caption font-semibold text-[#0d2033]">
          {userName.charAt(0).toUpperCase()}
        </span>
        <span className="truncate text-small font-medium">{userName}</span>
      </div>
    </div>
  );
}

function NavIcon({ item, active }: { item: ResolvedNavItem; active: boolean }) {
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

/** Mobile bottom navigation: Home | Financial | Analysis | Goals/Advanced | More (UIX-001). */
export function MobileNav({
  edition,
  features,
  role,
  locale,
  userName,
  planLabel,
  mode,
}: {
  edition: Edition;
  features?: Feature[] | null;
  role?: "user" | "admin";
  locale?: Locale;
  userName: string;
  planLabel: string;
  mode?: UserModeValue;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = navItemsFor(edition, { resolvedFeatures: features, role, locale, mode });
  const bottomKeys = bottomBarKeysFor(mode ?? "salary");
  const barItems = bottomKeys.map((key) => items.find((item) => item.key === key)).filter(
    (item): item is ResolvedNavItem => Boolean(item),
  );
  const moreItems = moreSheetItemsFor(edition, { resolvedFeatures: features, role, locale, mode });

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
              {moreItems.map((item) => {
                const active = isActiveNav(pathname, item);
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
          </div>
        ) : null}

        <nav aria-label="Main" className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1">
          {barItems.map((item) => {
            const active = isActiveNav(pathname, item);
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
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-pill",
                    active ? "bg-accent text-accent-contrast" : "text-text-muted",
                  )}
                >
                  <item.icon aria-hidden className="h-5 w-5" />
                </span>
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
                moreItems.some((item) => isActiveNav(pathname, item)) || moreOpen
                  ? "bg-accent text-accent-contrast"
                  : "text-text-muted",
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

