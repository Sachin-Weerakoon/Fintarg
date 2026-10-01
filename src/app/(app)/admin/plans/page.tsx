import type { Metadata } from "next";
import { requireAdmin } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { PLAN_MATRIX, PLANS, allFeatures, mergeFeatures, type Feature } from "@/lib/plans";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { ConfirmDelete } from "@/components/ui/ConfirmDelete";
import { savePlanFeaturesAction, resetPlanFeaturesAction } from "../actions";

export const metadata: Metadata = { title: "Feature flags" };
export const dynamic = "force-dynamic";

/**
 * FR-15.1: the plan x feature matrix.
 *
 * Saving writes one `PlanFeature` row per (plan, feature), so the code default in
 * `PLAN_MATRIX` is fully overridable without a deploy. "Reset to defaults" clears
 * those rows and puts the matrix back in charge.
 */
export default async function AdminPlansPage() {
  await requireAdmin();
  const csrfToken = await ensureCsrfToken();

  const features = allFeatures();
  const rows = await prisma.planFeature.findMany();
  const byKey = new Map(rows.map((row) => [`${row.plan}:${row.feature}`, row.enabled]));

  const effective = new Map<string, Feature[]>();
  for (const plan of PLANS) {
    const overrides = rows
      .filter((row) => row.plan === plan)
      .map((row) => ({ feature: row.feature, enabled: row.enabled }));
    effective.set(plan, mergeFeatures(plan, overrides));
  }

  return (
    <div className="flex flex-col gap-section">
      <PageHeader
        title="Feature flags"
        description="Turn a feature off for a plan and it disappears for everyone on that plan immediately - no deploy needed."
      />

      <AlertBanner
        level="info"
        title="Code defaults still apply"
        message="A feature that is not mentioned here follows the matrix in src/lib/plans.ts. Resetting clears every override."
      />

      <form action={savePlanFeaturesAction} className="flex flex-col gap-4">
        <input type="hidden" name="_csrf" value={csrfToken} />

        <Card>
          <CardHeader title="What each plan includes right now" />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-small">
              <caption className="sr-only">Feature flags by plan</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3 font-medium text-text">
                    Feature
                  </th>
                  {PLANS.map((plan) => (
                    <th key={plan} scope="col" className="py-2 px-3 font-medium text-text">
                      {PLAN_MATRIX[plan].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map(({ feature, label }) => (
                  <tr key={feature} className="border-b border-border/60">
                    <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                      <span className="block text-text">{label}</span>
                      <span className="block text-caption text-text-muted">{feature}</span>
                    </th>
                    {PLANS.map((plan) => {
                      const isOn = effective.get(plan)?.includes(feature) ?? false;
                      const overridden = byKey.has(`${plan}:${feature}`);
                      return (
                        <td key={plan} className="px-3 py-2.5 text-center">
                          <label className="inline-flex min-h-touch cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              name={`features.${plan}`}
                              value={feature}
                              defaultChecked={isOn}
                              className="h-4 w-4 rounded border-border accent-[var(--accent)]"
                            />
                            <span className="sr-only">
                              {label} for {PLAN_MATRIX[plan].label}
                            </span>
                            {overridden ? (
                              <span className="text-caption text-accent">(override)</span>
                            ) : null}
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <ConfirmDelete
            action={resetPlanFeaturesAction}
            hiddenFields={{ _csrf: csrfToken }}
            label="Reset to defaults"
            title="Reset every feature flag?"
            description="All overrides are cleared and the code defaults apply again."
            confirmLabel="Reset everything"
            variant="secondary"
          />
          <button
            type="submit"
            className="min-h-touch rounded-input bg-accent px-4 py-2 text-small font-medium text-white"
          >
            Save feature flags
          </button>
        </div>
      </form>
    </div>
  );
}