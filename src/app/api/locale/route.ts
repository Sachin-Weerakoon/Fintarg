import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/**
 * Sets the language cookie and returns the user to exactly where they were.
 *
 * A POST rather than a GET, so the language switch is not a prefetchable link and
 * cannot be triggered from a third-party page. No CSRF token is needed here: the
 * only effect is a same-site preference cookie that changes nothing but display.
 *
 * The referer is validated to be a same-origin path, so `?next=` cannot be used as
 * an open redirect.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const requested = formData.get("locale");
  const locale = isLocale(requested) ? requested : null;

  const back = safePath(formData.get("next"));

  if (locale) {
    const store = await cookies();
    // A year, so the choice survives a casual "clear cookies".
    store.set(LOCALE_COOKIE, locale, {
      path: "/",
      sameSite: "lax",
      maxAge: 365 * 86_400,
    });
  }

  return NextResponse.redirect(new URL(back || "/", request.url), { status: 303 });
}

/**
 * Only ever return a same-site absolute *path*.
 *
 * Rejects `//evil.com` (protocol-relative) as well as absolute URLs, which is the
 * classic open-redirect pair.
 */
function safePath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}