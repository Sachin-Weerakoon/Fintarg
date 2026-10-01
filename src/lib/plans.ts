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

/**
 * Features for a plan, honouring admin overrides stored in `PlanFeature`
 * (FR-15.1).
 *
 * `PLAN_MATRIX` stays the code default. A `PlanFeature` row with
 * `enabled = false` removes that feature for that plan; `enabled = true` adds a
 * feature the matrix did not grant. An absent row means "no opinion", so the
 * matrix decides.
 */
export function mergeFeatures(
  plan: Plan,
  overrides: { feature: string; enabled: boolean }[] = [],
): Feature[] {
  const base = [...PLAN_MATRIX[plan].features];
  if (overrides.length === 0) return base;

  const known = new Set<string>(FEATURES);
  const byFeature = new Map(overrides.map((row) => [row.feature, row.enabled]));

  const merged = base.filter((feature) => byFeature.get(feature) !== false);
  for (const [feature, enabled] of byFeature) {
    if (enabled && known.has(feature) && !merged.includes(feature as Feature)) {
      merged.push(feature as Feature);
    }
  }
  return merged;
}

export function can(edition: Edition | string | null | undefined, feature: Feature): boolean {
  return featuresOf(edition).includes(feature);
}

/**
 * Feature list for an edition. `resolvedFeatures` is the admin-merged list that
 * `getCurrentUser` resolved once per request; passing it in keeps this function
 * synchronous and client-safe, which `can()` relies on.
 */
export function featuresOf(
  edition: Edition | string | null | undefined,
  resolvedFeatures?: Feature[] | null,
): Feature[] {
  if (resolvedFeatures) return resolvedFeatures;
  return PLAN_MATRIX[planOf(edition)].features;
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

/* ------------------------------------------------- database-backed overrides */

import { prisma } from "@/lib/db";

/** Cached for a short window so one render does not re-query per `can()` call. */
const CACHE_TTL_MS = 30_000;
let cache: { at: number; data: Map<Plan, Feature[]> } | null = null;

/**
 * Resolve a plan's feature list from `PlanFeature`, falling back to the code
 * default. Server-only: it touches the database.
 */
export async function getPlanFeatures(plan: Plan): Promise<Feature[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    const hit = cache.data.get(plan);
    if (hit) return hit;
  }

  const rows = await prisma.planFeature.findMany({ where: { plan } });
  const merged = mergeFeatures(
    plan,
    rows.map((row) => ({ feature: row.feature, enabled: row.enabled })),
  );

  if (!cache) cache = { at: Date.now(), data: new Map() };
  cache.at = Date.now();
  cache.data.set(plan, merged);
  return merged;
}

/** Drop the cache after an admin edits flags, so the change applies immediately. */
export function invalidatePlanFeatureCache(): void {
  cache = null;
}

/** Every feature, for the admin matrix screen. */
export function allFeatures(): { feature: Feature; label: string }[] {
  return FEATURES.map((feature) => ({ feature, label: FEATURE_LABELS[feature] }));
}

const FEATURE_LABELS: Record<Feature, string> = {
  "core.finance": "Financial records",
  "core.analysis": "Analysis",
  "core.goals": "Savings goals",
  "core.personalSpending": "Personal spending",
  "core.vault": "Document vault",
  "core.letters.personal": "Personal letters",
  "core.medical": "Medical records",
  "core.settings": "Settings",
  "business.advanced": "Advanced section",
  "business.companies": "Companies",
  "business.letters.company": "Business letters",
};
