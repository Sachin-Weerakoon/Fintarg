"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, Briefcase, Check, User } from "lucide-react";
import { FormField, TextInput } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { loginAction, registerAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/validation";

const IDLE: FormState = { status: "idle" };

/** FR-1: register as Basic or Business, with a live "which plan is for me" hint. */
export function RegisterForm({ csrfToken }: { csrfToken: string }) {
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

      <FormField id="fullName" label="Full name" required error={errors.fullName}>
        <TextInput
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          error={errors.fullName}
          placeholder="Nimal Perera"
        />
      </FormField>

      <FormField id="email" label="Email" required error={errors.email}>
        <TextInput
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          error={errors.email}
          placeholder="you@example.com"
        />
      </FormField>

      <FormField
        id="password"
        label="Password"
        required
        hint="At least 8 characters, with one letter and one number."
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
        <legend className="text-small font-medium text-text">Which plan suits you?</legend>
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
            detail="Everything in Basic, plus companies and agreements."
          />
        </div>
      </fieldset>

      <SubmitButton pendingLabel="Creating your account...">Create account</SubmitButton>

      <p className="text-center text-small text-text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
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

export function LoginForm({ csrfToken }: { csrfToken: string }) {
  const [state, formAction] = useActionState(loginAction, IDLE);
  const errors = state.status === "error" ? state.errors ?? {} : {};

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-card" noValidate>
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

      <FormField id="email" label="Email" required error={errors.email}>
        <TextInput
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          error={errors.email}
          placeholder="you@example.com"
        />
      </FormField>

      <FormField id="password" label="Password" required error={errors.password}>
        <TextInput
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={errors.password}
        />
      </FormField>

      <SubmitButton pendingLabel="Signing you in...">Sign in</SubmitButton>

      <p className="text-center text-small text-text-muted">
        New to Fintarg?{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
