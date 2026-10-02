import { Globe } from "lucide-react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";

/**
 * Language switcher (Phase 3).
 *
 * Posts to `/api/locale` and returns to the page it was used on, so switching
 * language never costs the user their place. Rendered as a real form, not a set of
 * links, because the switch mutates a cookie and must not be prefetched.
 *
 * Server component: no client JavaScript is needed for a form post.
 */
export function LanguageSwitcher({
  locale,
  returnTo,
  compact = false,
}: {
  locale: Locale;
  /** Absolute path to come back to, e.g. "/analysis". */
  returnTo: string;
  compact?: boolean;
}) {
  const t = createTranslator(locale);
  const label = t("settings.language");

  return (
    <form action="/api/locale" method="post" className="flex flex-col gap-1.5">
      <input type="hidden" name="next" value={returnTo} />

      <label
        htmlFor="locale-select"
        className="inline-flex items-center gap-1.5 text-small font-medium text-text"
      >
        <Globe aria-hidden className="h-4 w-4 shrink-0" />
        {label}
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <select
          id="locale-select"
          name="locale"
          defaultValue={locale}
          className="min-h-touch rounded-input border border-border bg-surface px-3 py-2 text-small text-text"
        >
          {LOCALES.map((option) => (
            <option key={option} value={option} lang={HTML_LANG_ATTR[option]}>
              {LOCALE_LABELS[option]}
            </option>
          ))}
        </select>

        {!compact ? (
          <button
            type="submit"
            className="min-h-touch rounded-input border border-border bg-surface px-4 py-2 text-small font-medium text-text hover:bg-muted"
          >
            {t("common.save")}
          </button>
        ) : null}
      </div>

      {!compact ? (
        <p className="text-caption text-text-muted">{t("settings.languageHint")}</p>
      ) : null}
    </form>
  );
}

/** `lang` attribute for each option, so a mixed-language list stays readable. */
const HTML_LANG_ATTR: Record<Locale, string> = {
  en: "en",
  si: "si",
  ta: "ta",
};