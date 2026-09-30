import { cookies } from "next/headers";

/**
 * CSRF protection via the double-submit cookie pattern (NFR).
 *
 * The readable, non-httpOnly cookie is minted by `src/middleware.ts` - a Server
 * Component cannot write cookies. Every mutating form carries the same value in
 * a hidden field, and this check rejects any request where the two disagree.
 * Next.js Server Actions add their own origin check on top.
 */
export const CSRF_COOKIE = "fintarg_csrf";
export const CSRF_FIELD = "_csrf";

/** Read the current token. Only ever reads, never writes. */
export async function getCsrfToken(): Promise<string> {
  const store = await cookies();
  return store.get(CSRF_COOKIE)?.value ?? "";
}

/**
 * Kept for existing call sites. It no longer writes a cookie; it returns the
 * middleware-issued token, or an empty string if middleware was skipped.
 */
export async function ensureCsrfToken(): Promise<string> {
  return getCsrfToken();
}

export async function assertCsrf(formData: FormData): Promise<void> {
  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const formToken = formData.get(CSRF_FIELD);
  if (!cookieToken || typeof formToken !== "string" || formToken !== cookieToken) {
    throw new Error("CSRF_INVALID");
  }
}