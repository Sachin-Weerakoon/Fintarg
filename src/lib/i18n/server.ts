import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { createTranslator, type Translator } from "./index";

/**
 * Server-only half of the i18n layer.
 *
 * Split out from `./index` because that module is imported by `"use client"`
 * components, and `next/headers` cannot cross that boundary. Nothing outside a
 * Server Component may import this file.
 */

/** The locale this request should render in, from the cookie. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  return isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
}

/** Translator for this request. */
export async function getTranslator(): Promise<Translator> {
  return createTranslator(await getLocale());
}