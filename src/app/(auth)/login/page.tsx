import type { Metadata } from "next";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { getLocale } from "@/lib/i18n/server";
import { createTranslator } from "@/lib/i18n";
import { LoginForm } from "@/components/forms/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const [csrfToken, locale] = await Promise.all([ensureCsrfToken(), getLocale()]);
  const t = createTranslator(locale);

  return (
    <div>
      <h1 className="text-h1 font-semibold text-text">{t("auth.welcomeBack")}</h1>
      <p className="mt-1 mb-5 text-small text-text-muted">{t("auth.welcomeBackSubtitle")}</p>
      <LoginForm csrfToken={csrfToken} locale={locale} />
    </div>
  );
}