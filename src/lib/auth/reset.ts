import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { sendSms } from "@/lib/auth/sms";
import { hashPassword } from "@/lib/auth/password";
import type { Identifier } from "@/lib/identity";
import type { Prisma } from "@prisma/client";

/**
 * One-time tokens for password reset and verification (FR-1.3).
 *
 * Only the SHA-256 hash is stored, so a database dump cannot be replayed against
 * the reset endpoint - the same discipline used for session tokens. Every token
 * is single use (`usedAt`) and expires, and starting a new reset invalidates the
 * previous one for that user.
 */

const RESET_TTL_MS = 30 * 60 * 1000;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function newToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";

/** Create and email a reset link. Always succeeds quietly from the caller's view. */
export async function issuePasswordReset(identifier: Identifier, now = new Date()): Promise<void> {
  const user =
    identifier.kind === "email"
      ? await prisma.user.findFirst({ where: { email: identifier.value } })
      : await prisma.user.findFirst({ where: { mobile: identifier.value } });
  if (!user) return; // never reveal whether the account exists

  // Invalidate any outstanding reset so only the newest link works.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: now },
  });

  const { token, tokenHash } = newToken();
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(now.getTime() + RESET_TTL_MS) },
  });

  const link = `${APP_ORIGIN}/reset-password/${token}`;
  const minutes = Math.round(RESET_TTL_MS / 60_000);

  // Deliver by whichever channel the identifier implies (FR-1.3).
  if (identifier.kind === "email") {
    await sendEmail({
      to: identifier.value,
      subject: "Reset your Fintarg password",
      text: [
        "Hi,",
        "",
        `Use this link to choose a new password. It works once and expires in ${minutes} minutes:`,
        link,
        "",
        "If you did not ask for this, you can ignore this message - nothing has changed.",
      ].join("\n"),
    });
  } else if (user.mobile) {
    await sendSms({
      to: user.mobile,
      body: `Fintarg: reset your password here (valid ${minutes} min): ${link}`,
    });
  }
}

/**
 * Consume a reset token and set the new password.
 *
 * On success every session for that user is deleted and an audit row is written,
 * so a reset genuinely evicts anyone else holding a session.
 */
export async function consumePasswordReset(
  token: string,
  newPassword: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; reason: "invalid" | "expired" }> {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt) return { ok: false, reason: "invalid" };
  if (record.expiresAt < now) return { ok: false, reason: "expired" };

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: now } }),
    // Evict every session, including this user's other devices.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
    prisma.user.update({ where: { id: record.userId }, data: { failedLogins: 0, lockedUntil: null } }),
    prisma.auditLog.create({
      data: { userId: record.userId, action: "auth.password_reset", entityType: "user" },
    }),
  ]);

  return { ok: true };
}

/** Mint a fresh verification token and email it. */
export async function deliverVerification(userId: string, email: string): Promise<void> {
  await prisma.verificationToken.updateMany({
    where: { userId, purpose: "email", usedAt: null },
    data: { usedAt: new Date() },
  });

  const { token, tokenHash } = newToken();
  await prisma.verificationToken.create({
    data: { userId, tokenHash, purpose: "email", expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) },
  });

  await sendEmail({
    to: email,
    subject: "Confirm your Fintarg email address",
    text: [
      "Hi,",
      "",
      "Confirm your email address so we can reach you about your money dates:",
      `${APP_ORIGIN}/verify-email?token=${token}`,
      "",
      "Your account works either way - this is only so reminders can find you.",
    ].join("\n"),
  });
}

/** Consume a verification token and stamp `emailVerifiedAt`. */
export async function consumeVerification(token: string, now = new Date()): Promise<boolean> {
  const tokenHash = hashToken(token);
  const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < now) return false;

  await prisma.$transaction([
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: now } }),
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now } }),
  ] as Prisma.PrismaPromise<unknown>[]);
  return true;
}

export type { Identifier };