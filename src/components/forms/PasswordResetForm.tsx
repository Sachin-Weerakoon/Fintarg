"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FormField, TextInput } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { requestPasswordResetAction, resetPasswordAction } from "@/app/(auth)/actions";
import type { FormState } from "@/lib/validation";

const IDLE: FormState = { status: "idle" };

/** FR-1.3 step 1. The answer is deliberately the same either way. */
export function ForgotPasswordForm({ csrfToken }: { csrfToken: string }) {
  const [state, formAction] = useActionState(requestPasswordResetAction, IDLE);
  const errors = state.status === "error" ? state.errors ?? {} : {};

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-card" noValidate>
      <input type="hidden" name="_csrf" value={csrfToken} />

      <div aria-live="polite" className="sr-only">
        {state.status === "error" ? state.message : ""}
        {state.status === "success" ? state.message : ""}
      </div>

      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-input border border-danger/50 bg-danger-soft p-3 text-small text-danger">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      {state.status === "success" ? (
        <p role="status" className="flex items-start gap-2 rounded-input border border-positive/50 bg-positive-soft p-3 text-small text-positive">
          <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <FormField
        id="identifier"
        label="Email or mobile number"
        required
        hint="We send the link to whichever one you used to register."
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
          placeholder="you@example.com or 0771234567"
        />
      </FormField>

      <SubmitButton pendingLabel="Sending...">Send reset link</SubmitButton>

      <p className="text-center text-small text-text-muted">
        <Link href="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

/** FR-1.3 step 2. */
export function ResetPasswordForm({ csrfToken, token }: { csrfToken: string; token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, IDLE);
  const errors = state.status === "error" ? state.errors ?? {} : {};

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-card" noValidate>
      <input type="hidden" name="_csrf" value={csrfToken} />
      <input type="hidden" name="token" value={token} />

      <div aria-live="polite" className="sr-only">
        {state.status === "error" ? state.message : ""}
        {state.status === "success" ? state.message : ""}
      </div>

      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-input border border-danger/50 bg-danger-soft p-3 text-small text-danger">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      {state.status === "success" ? (
        <p role="status" className="flex items-start gap-2 rounded-input border border-positive/50 bg-positive-soft p-3 text-small text-positive">
          <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      {errors.token ? <p className="text-caption font-medium text-danger">{errors.token}</p> : null}

      <FormField
        id="password"
        label="New password"
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

      <FormField id="confirmPassword" label="Type it again" required error={errors.confirmPassword}>
        <TextInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          error={errors.confirmPassword}
        />
      </FormField>

      <SubmitButton pendingLabel="Saving...">Set new password</SubmitButton>
    </form>
  );
}
