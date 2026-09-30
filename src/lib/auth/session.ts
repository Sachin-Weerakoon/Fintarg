import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/auth/password";

export const SESSION_COOKIE = "fintarg_session";
export const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  edition: "basic" | "business";
  plan: string;
  fullName: string | null;
  themeAccent: string;
  themeMode: string;
  fontScale: string;
  density: string;
  profilePictureStoredName: string | null;
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
  return {
    id: user.id,
    email: user.email,
    edition: user.edition === "business" ? "business" : "basic",
    plan: user.plan,
    fullName: user.profile?.fullName ?? null,
    themeAccent: user.profile?.themeAccent ?? "#0f766e",
    themeMode: user.profile?.themeMode ?? "system",
    fontScale: user.profile?.fontScale ?? "medium",
    density: user.profile?.density ?? "comfortable",
    profilePictureStoredName: null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORISED");
  return user;
}

/** Remove expired sessions. Call from a cron route. */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}
