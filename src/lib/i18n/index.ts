import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { en, type Messages } from "./messages/en";
import { si } from "./messages/si";
import { ta } from "./messages/ta";

/**
 * Message lookup for the active locale.
 *
 * **Client-safe.** This module deliberately imports nothing from `next/headers`, so
 * a `"use client"` component can translate its own labels. Anything that needs the
 * request lives in `./server`.
 *
 * `t()` never fails silently. A genuinely unknown key returns the English string
 * rather than rendering a raw key like `nav.goals` in the middle of a sentence.
 */

const CATALOGUES: Record<Locale, Messages> = { en, si, ta };

export function messagesFor(locale: Locale): Messages {
  return CATALOGUES[locale] ?? CATALOGUES[DEFAULT_LOCALE];
}

export type MessageKey = keyof Messages;

export type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;

export function createTranslator(locale: Locale): Translator {
  const messages = messagesFor(locale);
  const fallback = messagesFor(DEFAULT_LOCALE);

  return (key, values) => {
    const template = messages[key] ?? fallback[key] ?? key;
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match,
    );
  };
}

export { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, LOCALE_LABELS, HTML_LANG, isLocale, matchLocale } from "./config";
export type { Locale, Messages };
export default messagesFor;