"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { clearRateLimit, rateLimit } from "@/lib/auth/rate-limit";
import { assertCsrf, ensureCsrfToken } from "@/lib/auth/csrf";
import {
  CONSENT_VERSION,
  flattenErrors,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type FormState,
} from "@/lib/validation";
import { parseIdentifier, type Identifier } from "@/lib/identity";
import { consumePasswordReset, consumeVerification, deliverVerification, issuePasswordReset } from "@/lib/auth/reset";
import { DEFAULT_ACCENT } from "@/lib/theme";
import { isEdition } from "@/lib/plans";

const DEFAULT_CATEGORIES = ["Food", "Transport", "Utilities", "Rent", "Personal/Enjoyment", "Medical", "Other"];

/** NFR-5: 8 failed sign-ins pause the account for 15 minutes. */
const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

async function requestMeta() {
  const store = await headers();
  return {
    userAgent: store.get("user-agent") ?? undefined,
    ip: store.get("x-forwarded-for")?.split(",")[0]?.trim() ?? store.get("x-real-ip") ?? undefined,
  };
}

/** Look up an account by whichever identifier the user typed. */
async function findByIdentifier(identifier: Identifier) {
  return identifier.kind === "email"
    ? prisma.user.findFirst({ where: { email: identifier.value } })
    : prisma.user.findFirst({ where: { mobile: identifier.value } });
}

export async function registerAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);

  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    edition: formData.get("edition"),
    consent: formData.get("consent"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: flattenErrors(parsed.error),
    };
  }

  const { fullName, password, edition, consent } = parsed.data;
  const identifier = parseIdentifier(parsed.data.identifier);
  if (!identifier) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: { identifier: "Enter a valid email address or mobile number" } };
  }

  const meta = await requestMeta();
  const limit = rateLimit(`register:${meta.ip ?? "unknown"}:${identifier.value}`, 5);
  if (!limit.allowed) {
    return {
      status: "error",
      message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const existing = await findByIdentifier(identifier);
  if (existing) {
    return {
      status: "error",
      message: "That email or mobile number is already registered.",
      errors: { identifier: "That email or mobile number is already registered" },
    };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      // Only store the identifier kind the user actually gave us.
      email: identifier.kind === "email" ? identifier.value : null,
      mobile: identifier.kind === "mobile" ? identifier.value : null,
      passwordHash,
      edition: isEdition(edition) ? edition : "basic",
      plan: edition === "business" ? "business" : "basic",
      lastLoginAt: new Date(),
      consentAt: new Date(),
      consentVersion: CONSENT_VERSION,
      profile: { create: { fullName, themeAccent: DEFAULT_ACCENT.hex, mobile: identifier.kind === "mobile" ? identifier.value : null } },
      categories: {
        create: DEFAULT_CATEGORIES.map((name, index) => ({
          name,
          sortOrder: index,
          isDefault: true,
        })),
      },
      // A verification link is emailed after the transaction commits, so a
      // mail failure cannot roll back a successful registration. Sign-in is
      // never blocked by it.
      auditLogs: { create: { action: "user.register", entityType: "user", meta: JSON.stringify({ identifier: identifier.kind, consent: CONSENT_VERSION }) } },
    },
  });

  // Deliver the verification link outside the transaction so a mail failure
  // cannot roll back a successful registration.
  if (identifier.kind === "email") {
    await deliverVerification(user.id, identifier.value).catch(() => undefined);
  }

  await createSession(user.id, meta);
  redirect("/");
}

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);

  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });

  // One generic message for every failure so the form cannot be used to discover
  // which email addresses or mobile numbers are registered.
  const genericError: FormState = {
    status: "error",
    message: "That email, mobile number or password is not right.",
    errors: {},
  };

  if (!parsed.success) return { status: "error", message: "Please fix the highlighted fields.", errors: flattenErrors(parsed.error) };

  const { password } = parsed.data;
  const identifier = parseIdentifier(parsed.data.identifier);
  if (!identifier) return genericError;

  const meta = await requestMeta();
  const limit = rateLimit(`login:${meta.ip ?? "unknown"}:${identifier.value}`, 8);
  if (!limit.allowed) {
    return {
      status: "error",
      message: `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const user = await findByIdentifier(identifier);
  if (!user) {
    // Hash anyway so a missing account and a wrong password take the same time.
    await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    return genericError;
  }

  // NFR-5: persistent lock-out, independent of the in-memory limiter.
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000));
    return {
      status: "error",
      message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failedLogins = user.failedLogins + 1;
    const lockedUntil = failedLogins >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MS) : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLogins, lockedUntil },
    });
    if (lockedUntil) {
      await prisma.auditLog.create({
        data: { userId: user.id, action: "auth.locked", entityType: "user", meta: JSON.stringify({ until: lockedUntil.toISOString() }) },
      });
      return {
        status: "error",
        message: "Too many failed attempts. This account is paused for 15 minutes.",
      };
    }
    return genericError;
  }

  if (user.suspendedAt) {
    return { status: "error", message: "This account is paused. Contact support for help." };
  }

  clearRateLimit(`login:${meta.ip ?? "unknown"}:${identifier.value}`);
  // Reset the counter on success so an old run of failures never locks later.
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null },
  });
  await createSession(user.id, meta);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * FR-1.3 step 1: always the same answer, whether or not the account exists, so
 * this form cannot be used to enumerate registered identifiers.
 */
export async function requestPasswordResetAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertCsrf(formData);

  const generic: FormState = {
    status: "success",
    message: "If that account exists, we have sent a reset link. It works once and expires in 30 minutes.",
  };

  const parsed = forgotPasswordSchema.safeParse({ identifier: formData.get("identifier") });
  if (!parsed.success) return generic;

  const identifier = parseIdentifier(parsed.data.identifier);
  if (!identifier) return generic;

  const meta = await requestMeta();
  // Two limits: per identifier and per IP, so neither can be sprayed.
  const byIdentifier = rateLimit(`reset-id:${identifier.value}`, 3, 30 * 60 * 1000);
  const byIp = rateLimit(`reset-ip:${meta.ip ?? "unknown"}`, 10, 30 * 60 * 1000);
  if (!byIdentifier.allowed || !byIp.allowed) {
    return {
      status: "error",
      message: "Too many reset requests. Try again in a few minutes.",
    };
  }

  try {
    await issuePasswordReset(identifier);
  } catch {
    // A transport failure must not reveal anything either.
  }

  return generic;
}

/** FR-1.3 step 2: consume the token, set the new password, evict all sessions. */
export async function resetPasswordAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);

  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", errors: flattenErrors(parsed.error) };
  }

  const result = await consumePasswordReset(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return {
      status: "error",
      message:
        result.reason === "expired"
          ? "That reset link has expired. Ask for a new one."
          : "That reset link is not valid any more. Ask for a new one.",
      errors: { token: "This link cannot be used" },
    };
  }

  return {
    status: "success",
    message: "Your password is changed and you have been signed out everywhere. Sign in with the new one.",
  };
}

/** Confirm an email address from the one-time link. Never blocks sign-in. */
export async function verifyEmailAction(formData: FormData): Promise<void> {
  await assertCsrf(formData);
  const token = String(formData.get("token") ?? "");
  if (token) await consumeVerification(token);
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * FR-1.3: send the confirmation link again.
 *
 * Rate limited to one send per 60 seconds so the banner cannot be used to mail-bomb
 * an address. Failures are reported plainly because the user is already signed in -
 * unlike password reset, this endpoint must not confirm whether an account exists.
 */
export async function resendVerificationAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);
  const user = await requireUser();

  if (!user.email) {
    return { status: "error", message: "This account has no email address to confirm." };
  }
  if (user.emailVerifiedAt) {
    return { status: "success", message: "This address is already confirmed." };
  }

  const last = await prisma.verificationToken.findFirst({
    where: { userId: user.id, purpose: "email" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < 60_000) {
    return { status: "error", message: "Please wait a minute before asking for another link." };
  }

  try {
    await deliverVerification(user.id, user.email);
  } catch {
    return { status: "error", message: "We could not send the email. Please try again shortly." };
  }

  return { status: "success", message: "Check your inbox for the confirmation link." };
}

/** FR-1: the current user's own profile, or null. */
export async function currentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export { ensureCsrfToken };
