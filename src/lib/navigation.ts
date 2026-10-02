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
import { type UserModeValue, hasBusinessLedger, hasPersonalLedger } from "@/lib/mode";

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
  /** Active for these route prefixes (for highlighting parent). */
  activeFor?: string[];
}

/** A nav item with its labels resolved for one request. */
export interface ResolvedNavItem extends NavItem {
  label: string;
  description: string;
}

/**
 * Base navigation items for all modes.
 * These 7 items form the complete navigation map (FR-14).
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
    key: "vault",
    href: "/vault",
    labelKey: "nav.vault",
    descriptionKey: "nav.vault.description",
    icon: FolderLock,
    feature: "core.vault",
  },
  {
    key: "advanced",
    href: "/advanced",
    labelKey: "nav.advanced",
    descriptionKey: "nav.advanced.description",
    icon: Briefcase,
    activeFor: ["/letters", "/medical", "/reminders", "/advanced"],
  },
  {
    key: "settings",
    href: "/settings",
    labelKey: "nav.settings",
    descriptionKey: "nav.settings.description",
    icon: Settings,
    feature: "core.settings",
  },
  {
    key: "letters",
    href: "/letters",
    labelKey: "nav.letters",
    descriptionKey: "nav.letters.description",
    icon: FileText,
    feature: "core.letters.personal",
    overflowOnly: true,
    activeFor: ["/letters"],
  },
  {
    key: "medical",
    href: "/medical",
    labelKey: "nav.medical",
    descriptionKey: "nav.medical.description",
    icon: HeartPulse,
    feature: "core.medical",
    overflowOnly: true,
    activeFor: ["/medical"],
  },
  {
    key: "reminders",
    href: "/reminders",
    labelKey: "nav.reminders",
    descriptionKey: "nav.reminders.description",
    icon: BellRing,
    overflowOnly: true,
    activeFor: ["/reminders"],
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
 * Advanced Features hub tiles. These are shown inside /advanced page.
 * Visibility is controlled by feature flags and mode.
 */
export const ADVANCED_HUB_TILES: NavItem[] = [
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
    key: "reminders",
    href: "/reminders",
    labelKey: "nav.reminders",
    descriptionKey: "nav.reminders.description",
    icon: BellRing,
  },
  {
    key: "businesses",
    href: "/advanced/businesses",
    labelKey: "nav.businesses",
    descriptionKey: "nav.businesses.description",
    icon: Briefcase,
    feature: "business.companies",
  },
  {
    key: "agreements",
    href: "/advanced/agreements",
    labelKey: "nav.agreements",
    descriptionKey: "nav.agreements.description",
    icon: FileText,
    feature: "business.advanced",
  },
];

/**
 * Nav for an edition and mode, in the caller's language.
 *
 * `resolvedFeatures` is the admin-merged feature list from the session, so a flag
 * switched off in the database removes the item here without a deploy. `role` gates
 * the admin entry. `mode` controls which of the 7 top-level items are shown.
 */
export function navItemsFor(
  edition: Edition,
  options: {
    resolvedFeatures?: Feature[] | null;
    role?: "user" | "admin";
    locale?: Locale;
    mode?: UserModeValue;
  } = {},
): ResolvedNavItem[] {
  const t = createTranslator(options.locale ?? "en");
  const mode = options.mode ?? "salary";

  return NAV_ITEMS.filter((item) => {
    // Admin gating
    if (item.adminOnly && options.role !== "admin") return false;

    // Mode gating
    if (item.key === "goals") {
      // Goals only visible when personal ledger exists
      if (!hasPersonalLedger(mode)) return false;
    }
    if (item.key === "advanced") {
      // Advanced only visible when business ledger exists
      if (!hasBusinessLedger(mode)) return false;
    }
    if (item.key === "vault") {
      // Documents always visible
    }

    // Feature gating
    if (item.overflowOnly) return false;
    if (!item.feature) return true;
    return featuresOf(edition, options.resolvedFeatures).includes(item.feature);
  }).map((item) => ({
    ...item,
    label: t(item.labelKey),
    description: t(item.descriptionKey),
  }));
}

/** Mobile bottom bar keys per mode (UIX-001). */
export function bottomBarKeysFor(mode: UserModeValue): readonly string[] {
  if (mode === "salary") {
    return ["home", "financial", "analysis", "goals"] as const;
  }
  // business and both
  return ["home", "financial", "analysis", "advanced"] as const;
}

/** Returns all items that can appear in the mobile "More" sheet for a mode. */
export function moreSheetItemsFor(
  edition: Edition,
  options: {
    resolvedFeatures?: Feature[] | null;
    role?: "user" | "admin";
    locale?: Locale;
    mode?: UserModeValue;
  } = {},
): ResolvedNavItem[] {
  const t = createTranslator(options.locale ?? "en");
  const mode = options.mode ?? "salary";

  return NAV_ITEMS.filter((item) => {
    // Admin gating
    if (item.adminOnly && options.role !== "admin") return false;

    // Mode gating
    if (item.key === "goals" && !hasPersonalLedger(mode)) return false;
    if (item.key === "advanced" && !hasBusinessLedger(mode)) return false;

    // Must be overflowOnly to appear in More sheet
    if (!item.overflowOnly) return false;

    // Feature gating
    if (!item.feature) return true;
    return featuresOf(edition, options.resolvedFeatures).includes(item.feature);
  }).map((item) => ({
    ...item,
    label: t(item.labelKey),
    description: t(item.descriptionKey),
  }));
}

/** Returns the Advanced Features hub tiles for a mode. */
export function advancedHubTilesFor(
  edition: Edition,
  options: {
    resolvedFeatures?: Feature[] | null;
    role?: "user" | "admin";
    locale?: Locale;
    mode?: UserModeValue;
  } = {},
): ResolvedNavItem[] {
  const t = createTranslator(options.locale ?? "en");
  const mode = options.mode ?? "salary";

  return ADVANCED_HUB_TILES.filter((item) => {
    // Admin gating
    if (item.adminOnly && options.role !== "admin") return false;

    // Mode gating
    if (item.key === "businesses" && !hasBusinessLedger(mode)) return false;
    if (item.key === "agreements" && !hasBusinessLedger(mode)) return false;

    // Feature gating
    if (!item.feature) return true;
    return featuresOf(edition, options.resolvedFeatures).includes(item.feature);
  }).map((item) => ({
    ...item,
    label: t(item.labelKey),
    description: t(item.descriptionKey),
  }));
}

/** Checks if a pathname should highlight a given nav item (including activeFor prefixes). */
export function isActive(pathname: string, item: ResolvedNavItem): boolean {
  if (item.key === "home") return pathname === "/";
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  if (item.activeFor) {
    return item.activeFor.some((prefix) => pathname.startsWith(prefix));
  }
  return false;
}

export { type UserModeValue, hasPersonalLedger, hasBusinessLedger } from "@/lib/mode";