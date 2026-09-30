"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { clearRateLimit, rateLimit } from "@/lib/auth/rate-limit";
import { assertCsrf, ensureCsrfToken } from "@/lib/auth/csrf";
import { flattenErrors, loginSchema, registerSchema, type FormState } from "@/lib/validation";
import { DEFAULT_ACCENT } from "@/lib/theme";
import { isEdition } from "@/lib/plans";

const DEFAULT_CATEGORIES = ["Food", "Transport", "Utilities", "Personal/Enjoyment", "Medical", "Other"];

async function requestMeta() {
  const store = await headers();
  return {
    userAgent: store.get("user-agent") ?? undefined,
    ip: store.get("x-forwarded-for")?.split(",")[0]?.trim() ?? store.get("x-real-ip") ?? undefined,
  };
}

export async function registerAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);

  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    edition: formData.get("edition"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      errors: flattenErrors(parsed.error),
    };
  }

  const { fullName, email, password, edition } = parsed.data;
  const meta = await requestMeta();
  const limit = rateLimit(`register:${meta.ip ?? "unknown"}:${email}`, 5);
  if (!limit.allowed) {
    return {
      status: "error",
      message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      status: "error",
      message: "That email is already registered.",
      errors: { email: "That email is already registered" },
    };
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      edition: isEdition(edition) ? edition : "basic",
      plan: edition === "business" ? "business" : "basic",
      lastLoginAt: new Date(),
      profile: { create: { fullName, themeAccent: DEFAULT_ACCENT.hex } },
      categories: {
        create: DEFAULT_CATEGORIES.map((name, index) => ({
          name,
          sortOrder: index,
          isDefault: true,
        })),
      },
      reminders: {
        create: [
          { kind: "welcome", title: "Welcome to Fintarg", dueDate: new Date() },
        ],
      },
      auditLogs: { create: { action: "user.register", entityType: "user" } },
    },
  });

  await createSession(user.id, meta);
  redirect("/");
}

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  await assertCsrf(formData);

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  // One generic message for both "no such user" and "wrong password" so the form
  // cannot be used to discover which emails are registered.
  const genericError: FormState = {
    status: "error",
    message: "That email or password is not right.",
    errors: {},
  };

  if (!parsed.success) return { status: "error", message: "Please fix the highlighted fields.", errors: flattenErrors(parsed.error) };

  const { email, password } = parsed.data;
  const meta = await requestMeta();
  const limit = rateLimit(`login:${meta.ip ?? "unknown"}:${email}`, 8);
  if (!limit.allowed) {
    return {
      status: "error",
      message: `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await verifyPassword(password, "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    return genericError;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return genericError;
  if (user.suspendedAt) {
    return { status: "error", message: "This account is paused. Contact support for help." };
  }

  clearRateLimit(`login:${meta.ip ?? "unknown"}:${email}`);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id, meta);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login");
}

/** FR-1: the current user's own profile, or null. */
export async function currentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export { ensureCsrfToken };
