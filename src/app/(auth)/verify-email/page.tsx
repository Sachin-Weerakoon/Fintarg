import type { Metadata } from "next";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { consumeVerification } from "@/lib/auth/reset";

export const metadata: Metadata = { title: "Confirm your email" };

/**
 * One-time email confirmation. Deliberately a plain GET page with a form button
 * rather than a link that mutates on click, so a mail scanner prefetching the URL
 * cannot consume the token.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const csrfToken = await ensureCsrfToken();
  const valid = token ? await isTokenUsable(token) : false;

  return (
    <div>
      <h1 className="text-h1 font-semibold text-text">Confirm your email address</h1>
      {valid ? (
        <form action="/verify-email" method="post" className="card mt-4 flex flex-col gap-4 p-card">
          <input type="hidden" name="_csrf" value={csrfToken} />
          <input type="hidden" name="token" value={token} />
          <p className="text-small text-text-muted">
            Confirming helps us reach you about your money dates. Your account already works without it.
          </p>
          <button
            type="submit"
            className="min-h-touch rounded-input bg-accent px-4 py-2 text-small font-medium text-white"
          >
            Confirm this address
          </button>
        </form>
      ) : (
        <p className="mt-2 text-small text-text-muted">
          This link is not valid any more. Sign in and request a new one from Settings if you need it.
        </p>
      )}
    </div>
  );
}

async function isTokenUsable(token: string): Promise<boolean> {
  const { createHash } = await import("node:crypto");
  const { prisma } = await import("@/lib/db");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });
  return Boolean(record && !record.usedAt && record.expiresAt > new Date());
}
