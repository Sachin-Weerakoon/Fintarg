"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, Briefcase, Check, User } from "lucide-react";
import { FormField, TextInput } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { loginAction, registerAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/validation";
import { createTranslator, type Locale } from "@/lib/i18n";

const IDLE: FormState = { status: "idle" };

/** FR-1: register as Basic or Business, with a live "which plan is for me" hint. */
export function RegisterForm({ csrfToken, locale = "en" }: { csrfToken: string; locale?: Locale }) {
  const t = createTranslator(locale);
  const [state, formAction] = useActionState(registerAction, IDLE);
  const [edition, setEdition] = useState<"basic" | "business">("basic");
  const errors = state.status === "error" ? state.errors ?? {} : {};

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-card" noValidate>
      <input type="hidden" name="_csrf" value={csrfToken} />
      <input type="hidden" name="edition" value={edition} />

      <div aria-live="polite" className="sr-only">
        {state.status === "error" ? state.message : ""}
      </div>

      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-input border border-danger/50 bg-danger-soft p-3 text-small text-danger">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <FormField id="fullName" label={t("auth.nameLabel")} required error={errors.fullName}>
        <TextInput
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          error={errors.fullName}
          placeholder="Nimal Perera"
        />
      </FormField>

      <FormField
        id="identifier"
        label={t("auth.identifierLabel")}
        required
        hint="Either one works. A mobile number is used for SMS sign-in."
        error={errors.identifier}
      >
        <TextInput
          id="identifier"
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          required
          error={errors.identifier}
          placeholder={t("auth.identifierPlaceholder")}
        />
      </FormField>

      <FormField
id="password"
        label={t("auth.passwordLabel")}
        required
        hint={t("auth.passwordHint")}
        error={errors.password}
      >
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          error={errors.password}
        />
      </FormField>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium text-text">{t("auth.choosePlan")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <EditionOption
            id="edition-basic"
            value="basic"
            current={edition}
            onSelect={setEdition}
            icon={<User aria-hidden className="h-4 w-4" />}
            title="Basic"
            detail="Personal money, goals and documents."
          />
          <EditionOption
            id="edition-business"
            value="business"
            current={edition}
            onSelect={setEdition}
            icon={<Briefcase aria-hidden className="h-4 w-4" />}
            title="Business"
            detail={t("auth.planBusinessDetail")}
          />
        </div>
      </fieldset>

<FormField
        id="consent"
        label={t("auth.consentLabel")}
        error={errors.consent}
      >
        <div className="flex items-start gap-2">
          <input
            id="consent"
            name="consent"
            type="checkbox"
            required
            className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-[var(--accent)]"
            aria-describedby="consent-hint"
          />
          <p id="consent-hint" className="text-caption text-text-muted">
            {t("auth.consentHint")}
          </p>
        </div>
      </FormField>

      <SubmitButton pendingLabel={t("auth.creatingAccount")}>{t("auth.createAccount")}</SubmitButton>

      <p className="text-center text-small text-text-muted">
        {t("auth.haveAccount")} {" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </form>
  );
}

function EditionOption({
  id,
  value,
  current,
  onSelect,
  icon,
  title,
  detail,
}: {
  id: string;
  value: "basic" | "business";
  current: "basic" | "business";
  onSelect: (value: "basic" | "business") => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      id={id}
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={cn(
        "flex min-h-touch flex-col items-start gap-1 rounded-input border p-3 text-left transition-colors",
        selected ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-muted",
      )}
    >
      <span className={cn("flex items-center gap-2 text-small font-medium", selected ? "text-accent" : "text-text")}>
        {icon}
        {title}
        {selected ? <Check aria-hidden className="h-4 w-4" /> : null}
      </span>
      <span className="text-caption text-text-muted">{detail}</span>
    </button>
  );
}

export function LoginForm({ csrfToken, locale = "en" }: { csrfToken: string; locale?: Locale }) {
  const t = createTranslator(locale);
  const [state, formAction] = useActionState(loginAction, IDLE);
  const errors = state.status === "error" ? state.errors ?? {} : {};

  return (
    <form action={formAction} className="card flex flex-col gap-4 rounded-[22px] border-[#dfe7ed] bg-[#f8fafb] p-6 shadow-[0_2px_10px_rgba(17,34,55,0.04)]" noValidate>
      <input type="hidden" name="_csrf" value={csrfToken} />

      <div aria-live="polite" className="sr-only">
        {state.status === "error" ? state.message : ""}
      </div>

      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-input border border-danger/50 bg-danger-soft p-3 text-small text-danger">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <FormField
        id="identifier"
        label={t("auth.identifierLabel")}
        required
        error={errors.identifier}
      >
        <TextInput
          id="identifier"
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          required
          error={errors.identifier}
          placeholder={t("auth.identifierPlaceholder")}
        />
      </FormField>

      <FormField id="password" label={t("auth.passwordLabel")} required error={errors.password}>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={errors.password}
        />
      </FormField>

      <div className="mt-1 flex justify-center">
        <Link href="/forgot-password" className="text-[1.05rem] font-medium text-[#0c8d8a] hover:underline">
          {t("auth.forgotPassword")}
        </Link>
      </div>

      <SubmitButton
        className="mt-1 h-[58px] rounded-[16px] bg-[#0f8d8e] text-[1.05rem] font-semibold text-white shadow-[0_6px_18px_rgba(15,141,142,0.25)]"
        pendingLabel={t("auth.signingIn")}
      >
        {t("auth.signIn")}
      </SubmitButton>

      <p className="text-center text-[1.05rem] text-[#586a7d]">
        {t("auth.newHere")} {" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          {t("auth.createAccount")}
        </Link>
      </p>
    </form>
  );
}
