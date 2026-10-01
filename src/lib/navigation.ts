import {
  BarChart3,
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

export interface NavItem {
  key: string;
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  feature?: Feature;
  /** Only shown to accounts whose role is "admin" (FR-1.6). */
  adminOnly?: boolean;
  /** Only shown in the mobile "More" sheet, not the bottom bar. */
  overflowOnly?: boolean;
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
    label: "Home",
    description: "Your month at a glance",
    icon: LayoutDashboard,
  },
  {
    key: "financial",
    href: "/financial",
    label: "Financial",
    description: "Income, expenses, bills, loans and pawned items",
    icon: BarChart3,
    feature: "core.finance",
  },
  {
    key: "analysis",
    href: "/analysis",
    label: "Analysis",
    description: "Monthly analysis and next month",
    icon: BarChart3,
    feature: "core.analysis",
  },
  {
    key: "goals",
    href: "/goals",
    label: "Goals",
    description: "Savings goals and progress",
    icon: Target,
    feature: "core.goals",
  },
  {
    key: "letters",
    href: "/letters",
    label: "Letters",
    description: "Generate and store letters",
    icon: FileText,
    feature: "core.letters.personal",
  },
  {
    key: "medical",
    href: "/medical",
    label: "Medical",
    description: "Medical expenses, records and reminders",
    icon: HeartPulse,
    feature: "core.medical",
  },
  {
    key: "advanced",
    href: "/advanced",
    label: "Advanced",
    description: "Company profiles and agreements",
    icon: Briefcase,
    feature: "business.advanced",
    overflowOnly: true,
  },
  {
    key: "vault",
    href: "/vault",
    label: "Documents",
    description: "Your private document vault",
    icon: FolderLock,
    feature: "core.vault",
    overflowOnly: true,
  },
  {
    key: "settings",
    href: "/settings",
    label: "Settings",
    description: "Profile, theme, contacts and plan",
    icon: Settings,
    feature: "core.settings",
    overflowOnly: true,
  },
  {
    key: "admin",
    href: "/admin",
    label: "Admin",
    description: "Accounts and feature flags",
    icon: ShieldCheck,
    adminOnly: true,
    overflowOnly: true,
  },
];

/**
 * Nav for an edition.
 *
 * `resolvedFeatures` is the admin-merged feature list from the session, so a flag
 * switched off in the database removes the item here without a deploy. `role`
 * gates the admin entry.
 */
export function navItemsFor(
  edition: Edition,
  options: { resolvedFeatures?: Feature[] | null; role?: "user" | "admin" } = {},
): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.adminOnly && options.role !== "admin") return false;
    if (!item.feature) return true;
    return featuresOf(edition, options.resolvedFeatures).includes(item.feature);
  });
}

/** Mobile bottom bar: Home | Analysis | Goals | More (UIX-001). */
export const BOTTOM_BAR_KEYS = ["home", "analysis", "goals"] as const;

export function secondaryItems(
  edition: Edition,
  options: { resolvedFeatures?: Feature[] | null; role?: "user" | "admin" } = {},
): NavItem[] {
  return navItemsFor(edition, options).filter(
    (item) => item.overflowOnly && !BOTTOM_BAR_KEYS.includes(item.key as (typeof BOTTOM_BAR_KEYS)[number]),
  );
}
