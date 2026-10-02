/**
 * Internationalisation configuration (Phase 3: Sinhala and Tamil).
 *
 * Deliberately **no locale prefix in the URL**. The app has ~40 screens and every
 * one of them links to the others; prefixing would mean a redirect matrix, a
 * rewrite rule and a second copy of every `href`. The locale instead rides in a
 * cookie, so every existing link, bookmark and email keeps working and switching
 * language never changes the page you are on.
 *
 * No `next-intl` or similar: the project takes no new runtime dependency, and the
 * amount of machinery needed here is small.
 */

export const LOCALES = ["en", "si", "ta"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "fintarg_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  si: "සිංහල",
  ta: "தமிழ்",
};

/** BCP-47 tags, for `<html lang>`. */
export const HTML_LANG: Record<Locale, string> = {
  en: "en",
  si: "si-LK",
  ta: "ta-LK",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Best supported locale from an `Accept-Language` header.
 *
 * Matches on the primary subtag, so `si-LK`, `si` and `ta-LK` all work. Returns
 * `null` when nothing matches, so the caller can tell "no preference expressed"
 * apart from "prefers a language we do not have".
 */
export function matchLocale(acceptLanguage: string | null | undefined): Locale | null {
  if (!acceptLanguage) return null;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((param) => param.trim().startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.trim().slice(2)) : 1 };
    })
    .filter((entry) => entry.tag.length > 0 && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const primary = tag.split("-")[0];
    const exact = LOCALES.find((locale) => locale === tag);
    if (exact) return exact;
    const partial = LOCALES.find((locale) => locale === primary);
    if (partial) return partial;
  }
  return null;
}