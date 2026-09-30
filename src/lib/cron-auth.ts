import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Shared guard for the scheduled job routes.
 *
 * Vercel Cron and most schedulers send an `Authorization: Bearer <secret>`
 * header. In development, a request with no configured secret is allowed so the
 * jobs can be exercised by hand; in production a missing or wrong secret is a
 * hard 401.
 */

function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : (request.headers.get("x-cron-secret") ?? "");
  if (!provided) return false;
  return safeEqual(provided, secret);
}
