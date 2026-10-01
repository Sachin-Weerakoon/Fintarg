import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/auth/password";
import { getPlanFeatures, type Feature } from "@/lib/plans";
import { displayNameFor } from "@/lib/identity";

export const SESSION_COOKIE = "fintarg_session";
export const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  /** Nullable: an account may be registered with a mobile number only (FR-1.1). */
  email: string | null;
  mobile: string | null;
  edition: "basic" | "business";
  plan: string;
  role: "user" | "admin";
  /** Admin-merged feature list, resolved once per request (FR-15.1). */
  features: Feature[];
  fullName: string | null;
  displayName: string;
  themeAccent: string;
  themeMode: string;
  fontScale: string;
  density: string;
  emailVerifiedAt: Date | null;
  profilePictureDocumentId: string | null;
  /**
   * True when the account has an email address that was never verified. Accounts
   * registered with a mobile number only are never flagged, because there is no
   * address to verify.
   */
  needsVerification: boolean;
}

export async function createSession(userId: string, meta?: { userAgent?: string; ip?: string }): Promise<void> {
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta?.userAgent?.slice(0, 255),
      ip: meta?.ip,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** Resolve the current user, or null. Session persistence works across devices. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { profile: true } } },
  });

  if (!session || session.expiresAt < new Date() || session.user.suspendedAt) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Fire-and-forget liveness update; never block the render on it.
  prisma.session
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  const { user } = session;
  const edition = user.edition === "business" ? "business" : "basic";
  const fullName = user.profile?.fullName ?? null;

  return {
    id: user.id,
    email: user.email,
    mobile: user.mobile,
    edition,
    plan: user.plan,
    role: user.role === "admin" ? "admin" : "user",
    // Resolved once here so `can()` stays synchronous everywhere else.
    features: await getPlanFeatures(edition === "business" ? "business" : "basic"),
    fullName,
    displayName: displayNameFor({ fullName, email: user.email, mobile: user.mobile }),
    themeAccent: user.profile?.themeAccent ?? "#0f766e",
    themeMode: user.profile?.themeMode ?? "system",
    fontScale: user.profile?.fontScale ?? "medium",
    density: user.profile?.density ?? "comfortable",
    emailVerifiedAt: user.emailVerifiedAt,
    needsVerification: Boolean(user.email) && !user.emailVerifiedAt,
    profilePictureDocumentId: null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORISED");
  return user;
}

/** The raw session token from the request cookie, or null. Never logged. */
export async function currentSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Mark the current session as freshly re-authenticated (FR-12.5). Restricted
 * vault downloads require this to be within 30 minutes.
 */
export async function touchReauth(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(token) },
    data: { reauthAt: new Date() },
  });
}

/** How recently the current session re-entered its password, or null. */
export async function currentReauthAt(): Promise<Date | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { reauthAt: true },
  });
  return session?.reauthAt ?? null;
}

/** Delete every session for a user except (optionally) the current one. */
export async function deleteOtherSessions(userId: string, keepToken?: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      userId,
      ...(keepToken ? { tokenHash: { not: hashToken(keepToken) } } : {}),
    },
  });
  return result.count;
}

/** Remove expired sessions. Call from a cron route. */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}
