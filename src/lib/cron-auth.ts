import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Shared guard for the scheduled job routes.
 *
 * Vercel Cron and most schedulers send an `Authorization: Bearer <secret>`
 * header.
 *
 * The guard **fails closed**. `/api/cron/maintenance` hard-deletes accounts, so a
 * route that quietly opens when a variable is missing is a dangerous default: a
 * deployment that forgot to set `CRON_SECRET` would let anyone who guessed the
 * path purge user data. Opening it therefore requires an explicit, deliberate
 * `CRON_ALLOW_OPEN=true`, which exists purely so a developer can exercise the jobs
 * from a terminal.
 *
 * Both spellings are accepted: `Authorization: Bearer <secret>` and `X-Cron-Secret`.
 */

function safeEqual(a: string, b: string): boolean {
  // Hashing first gives both sides the same length, so timingSafeEqual cannot
  // throw on a length mismatch.
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    // No secret configured: open only if someone opted in by hand.
    return process.env.CRON_ALLOW_OPEN === "true";
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ")
    ? header.slice(7)
    : (request.headers.get("x-cron-secret") ?? "");
  if (!provided) return false;
  return safeEqual(provided, secret);
}