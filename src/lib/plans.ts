/**
 * Editions, plans and feature flags (FR-15, BR-7).
 *
 * Feature access is *never* hard-coded in a screen: every menu item, route and
 * gated component asks `can()` first. Adding the Business edition later is
 * therefore a data change, not a code change.
 */

export const EDITIONS = ["basic", "business"] as const;
export type Edition = (typeof EDITIONS)[number];

export const PLANS = ["free", "basic", "business"] as const;
export type Plan = (typeof PLANS)[number];

export const FEATURES = [
  "core.finance",
  "core.analysis",
  "core.goals",
  "core.personalSpending",
  "core.vault",
  "core.letters.personal",
  "core.medical",
  "core.settings",
  "business.advanced",
  "business.companies",
  "business.letters.company",
] as const;
export type Feature = (typeof FEATURES)[number];

const BASIC_FEATURES: Feature[] = [
  "core.finance",
  "core.analysis",
  "core.goals",
  "core.personalSpending",
  "core.vault",
  "core.letters.personal",
  "core.medical",
  "core.settings",
];

const BUSINESS_FEATURES: Feature[] = [
  ...BASIC_FEATURES,
  "business.advanced",
  "business.companies",
  "business.letters.company",
];

export const PLAN_MATRIX: Record<Plan, { label: string; features: Feature[] }> = {
  free: { label: "Free", features: BASIC_FEATURES },
  basic: { label: "Basic", features: BASIC_FEATURES },
  business: { label: "Business", features: BUSINESS_FEATURES },
};

export function planOf(edition: Edition | string | null | undefined): Plan {
  return edition === "business" ? "business" : "basic";
}

export function can(edition: Edition | string | null | undefined, feature: Feature): boolean {
  return PLAN_MATRIX[planOf(edition)].features.includes(feature);
}

export function planLabel(edition: Edition | string | null | undefined): string {
  return PLAN_MATRIX[planOf(edition)].label;
}

/** True when the user would gain something by upgrading (FR-15 upgrade path). */
export function canUpgrade(edition: Edition | string | null | undefined): boolean {
  return planOf(edition) === "basic";
}

export function isEdition(value: unknown): value is Edition {
  return typeof value === "string" && (EDITIONS as readonly string[]).includes(value);
}
