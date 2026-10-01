import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { can, featuresOf, type Feature } from "@/lib/plans";

/**
 * Server-side gates. Navigation is only a convenience - these functions are the
 * enforcement points, so a Basic user who types a Business URL gets the upgrade
 * screen rather than the data (BR-7).
 */
export async function requireFeature(feature: Feature): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!featuresOf(user.edition, user.features).includes(feature)) redirect("/settings#plan");
  return user;
}

/**
 * FR-1.6: admin role check.
 *
 * Admins manage accounts (edition, plan, suspension) and plan feature flags.
 * They must never reach financial records or documents, so this deliberately
 * returns the user only for the `/admin` section - the admin pages query nothing
 * but `User` and `PlanFeature` columns.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return user;
}

export { can };