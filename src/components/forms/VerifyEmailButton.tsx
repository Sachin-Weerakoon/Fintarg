"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/app/(auth)/actions";
import type { FormState } from "@/lib/validation";
import { Button } from "@/components/ui/Button";

const INITIAL: FormState = { status: "idle" };

/**
 * Banner action for an unverified address (FR-1.3). A client component is needed
 * only for the pending state and the inline result message.
 */
export function VerifyEmailButton({ csrfToken }: { csrfToken: string }) {
  const [state, formAction, pending] = useActionState(resendVerificationAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="_csrf" value={csrfToken} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Sending..." : "Resend the link"}
      </Button>
      {state.status !== "idle" ? (
        <p
          role="status"
          className={state.status === "error" ? "text-caption text-danger" : "text-caption text-text-muted"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
