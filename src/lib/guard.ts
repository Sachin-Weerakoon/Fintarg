import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import { can, type Feature } from "@/lib/plans";

/**
 * Server-side feature gate. Navigation is only a convenience - this is the
 * enforcement point for BR-7, so a Basic user who types a Business URL gets
 * the upgrade screen rather than the data.
 */
export async function requireFeature(feature: Feature): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.edition, feature)) redirect("/settings#plan");
  return user;
}
