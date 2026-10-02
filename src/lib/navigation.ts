import {
  BarChart3,
  BellRing,
  Briefcase,
  FileText,
  FolderLock,
  HeartPulse,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { ComponentType } from "react";
import { featuresOf, type Edition, type Feature } from "@/lib/plans";
import { createTranslator, type Locale, type MessageKey } from "@/lib/i18n";

export interface NavItem {
  key: string;
  href: string;
  /** Dictionary keys. The English strings live in the catalogue, not here. */
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  feature?: Feature;
  /** Only shown to accounts whose role is "admin" (FR-1.6). */
  adminOnly?: boolean;
  /** Only shown in the mobile "More" sheet, not the bottom bar. */
  overflowOnly?: boolean;
}

/** A nav item with its labels resolved for one request. */
export interface ResolvedNavItem extends NavItem {
  label: string;
  description: string;
}

/**
 * Navigation map (FR-14). Every entry declares the feature flag that governs its
 * visibility, so Basic users never see "Advanced" and Business users get it
 * without a code change.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    key: "home",
    href: "/",
    labelKey: "nav.home",
    descriptionKey: "nav.home.description",
    icon: LayoutDashboard,
  },
  {
    key: "financial",
    href: "/financial",
    labelKey: "nav.financial",
    descriptionKey: "nav.financial.description",
    icon: BarChart3,
    feature: "core.finance",
  },
  {
    key: "analysis",
    href: "/analysis",
    labelKey: "nav.analysis",
    descriptionKey: "nav.analysis.description",
    icon: BarChart3,
    feature: "core.analysis",
  },
  {
    key: "goals",
    href: "/goals",
    labelKey: "nav.goals",
    descriptionKey: "nav.goals.description",
    icon: Target,
    feature: "core.goals",
  },
  {
    key: "letters",
    href: "/letters",
    labelKey: "nav.letters",
    descriptionKey: "nav.letters.description",
    icon: FileText,
    feature: "core.letters.personal",
  },
  {
    key: "medical",
    href: "/medical",
    labelKey: "nav.medical",
    descriptionKey: "nav.medical.description",
    icon: HeartPulse,
    feature: "core.medical",
  },
  {
    key: "advanced",
    href: "/advanced",
    labelKey: "nav.advanced",
    descriptionKey: "nav.advanced.description",
    icon: Briefcase,
    feature: "business.advanced",
    overflowOnly: true,
  },
  {
    key: "vault",
    href: "/vault",
    labelKey: "nav.vault",
    descriptionKey: "nav.vault.description",
    icon: FolderLock,
    feature: "core.vault",
    overflowOnly: true,
  },
  {
    key: "settings",
    href: "/settings",
    labelKey: "nav.settings",
    descriptionKey: "nav.settings.description",
    icon: Settings,
    feature: "core.settings",
    overflowOnly: true,
  },
  {
    key: "reminders",
    href: "/reminders",
    labelKey: "nav.reminders",
    descriptionKey: "nav.reminders.description",
    icon: BellRing,
    overflowOnly: true,
  },
  {
    key: "admin",
    href: "/admin",
    labelKey: "nav.admin",
    descriptionKey: "nav.admin.description",
    icon: ShieldCheck,
    adminOnly: true,
    overflowOnly: true,
  },
];

/**
 * Nav for an edition, in the caller's language.
 *
 * `resolvedFeatures` is the admin-merged feature list from the session, so a flag
 * switched off in the database removes the item here without a deploy. `role` gates
 * the admin entry.
 */
export function navItemsFor(
  edition: Edition,
  options: {
    resolvedFeatures?: Feature[] | null;
    role?: "user" | "admin";
    locale?: Locale;
  } = {},
): ResolvedNavItem[] {
  const t = createTranslator(options.locale ?? "en");
  return NAV_ITEMS.filter((item) => {
    if (item.adminOnly && options.role !== "admin") return false;
    if (!item.feature) return true;
    return featuresOf(edition, options.resolvedFeatures).includes(item.feature);
  }).map((item) => ({
    ...item,
    label: t(item.labelKey),
    description: t(item.descriptionKey),
  }));
}

/** Mobile bottom bar: Home | Analysis | Goals | More (UIX-001). */
export const BOTTOM_BAR_KEYS = ["home", "analysis", "goals"] as const;

export function secondaryItems(
  edition: Edition,
  options: {
    resolvedFeatures?: Feature[] | null;
    role?: "user" | "admin";
    locale?: Locale;
  } = {},
): ResolvedNavItem[] {
  return navItemsFor(edition, options).filter(
    (item) => item.overflowOnly && !BOTTOM_BAR_KEYS.includes(item.key as (typeof BOTTOM_BAR_KEYS)[number]),
  );
}