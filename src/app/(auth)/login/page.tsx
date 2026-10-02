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
      <h1 className="text-center text-[clamp(2.6rem,4vw,3.5rem)] font-semibold leading-none tracking-[-0.05em] text-[#1b2e3d]">
        {t("auth.welcomeBack")}
      </h1>
      <p className="mt-3 mb-6 text-center text-[1.05rem] text-[#586a7d]">
        {t("auth.welcomeBackSubtitle")}
      </p>
      <LoginForm csrfToken={csrfToken} locale={locale} />
    </div>
  );
}