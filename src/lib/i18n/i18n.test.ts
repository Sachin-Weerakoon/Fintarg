import { describe, expect, it } from "vitest";
import { LOCALES, matchLocale, isLocale, DEFAULT_LOCALE, HTML_LANG } from "@/lib/i18n/config";
import { createTranslator, messagesFor } from "@/lib/i18n";
import en from "@/lib/i18n/messages/en";
import si from "@/lib/i18n/messages/si";
import ta from "@/lib/i18n/messages/ta";

describe("locale completeness", () => {
  // The typed `Messages` shape already makes a missing key a compile error. These
  // assertions guard the other direction: a key that is present but left as the
  // English text would compile fine and ship a half-translated screen.
  it("every locale defines exactly the English key set", () => {
    const keys = Object.keys(en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(messagesFor(locale)).sort()).toEqual(keys);
    }
  });

  it("no Sinhala or Tamil string is left in English", () => {
    for (const [locale, messages] of [
      ["si", si],
      ["ta", ta],
    ] as const) {
      const untranslated = Object.entries(messages).filter(
        ([key, value]) => value === en[key as keyof typeof en] && !/^[0-9.:/%()-]+$/.test(value),
      );
      expect({ locale, untranslated: untranslated.map(([key]) => key) }).toEqual({
        locale,
        untranslated: [],
      });
    }
  });

  it("no string is blank", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(messagesFor(locale))) {
        expect(value, `${locale}:${key}`).not.toBe("");
      }
    }
  });

  it("placeholders survive translation", () => {
    // If a translator drops {days}, the UI silently renders the literal braces.
    const placeholders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();
    for (const locale of LOCALES) {
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(placeholders(messagesFor(locale)[key]), `${locale}:${key}`).toEqual(placeholders(en[key]));
      }
    }
  });
});

describe("createTranslator", () => {
  it("returns the English string for the English locale", () => {
    expect(createTranslator("en")("nav.goals")).toBe("Goals");
  });

  it("returns the Sinhala string for Sinhala", () => {
    expect(createTranslator("si")("nav.goals")).toBe("ඉලක්ක");
  });

  it("substitutes placeholders", () => {
    expect(createTranslator("en")("status.inDays", { days: 3 })).toBe("in 3 days");
    expect(createTranslator("si")("status.inDays", { days: 3 })).toContain("3");
  });

  it("leaves a placeholder alone when no value is supplied, rather than printing undefined", () => {
    expect(createTranslator("en")("status.inDays")).toBe("in {days} days");
  });

  it("leaves an unknown placeholder untouched instead of blanking it", () => {
    expect(createTranslator("en")("status.inDays", { other: 1 })).toBe("in {days} days");
  });

  it("translates numbers zero and one correctly in every locale", () => {
    for (const locale of LOCALES) {
      const t = createTranslator(locale);
      expect(t("status.inDays", { days: 0 })).toContain("0");
      expect(t("status.inDays", { days: 1 })).toContain("1");
    }
  });
});

describe("matchLocale", () => {
  it("matches an exact tag", () => {
    expect(matchLocale("si")).toBe("si");
    expect(matchLocale("ta-LK")).toBe("ta");
  });

  it("matches on the primary subtag", () => {
    expect(matchLocale("si-LK")).toBe("si");
    expect(matchLocale("ta-IN")).toBe("ta");
  });

  it("honours the quality ordering", () => {
    expect(matchLocale("en;q=0.2,si;q=0.9")).toBe("si");
  });

  it("ignores a language we do not support", () => {
    expect(matchLocale("fr-FR,fr;q=0.9")).toBeNull();
  });

  it("returns null when nothing was expressed", () => {
    expect(matchLocale(null)).toBeNull();
    expect(matchLocale("")).toBeNull();
  });
});

describe("locale config", () => {
  it("only accepts a known locale", () => {
    expect(isLocale("si")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });

  it("defaults to English", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("gives every locale an html lang tag", () => {
    for (const locale of LOCALES) {
      expect(HTML_LANG[locale]).toMatch(/^(en|si|ta)/);
    }
  });
});