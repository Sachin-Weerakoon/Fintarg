import type { Metadata } from "next";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { ForgotPasswordForm } from "@/components/forms/PasswordResetForm";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  const csrfToken = await ensureCsrfToken();
  return (
    <div>
      <h1 className="text-h1 font-semibold text-text">Forgotten your password?</h1>
      <p className="mt-1 mb-5 text-small text-text-muted">
        Tell us the email or mobile number on the account and we will send a link.
      </p>
      <ForgotPasswordForm csrfToken={csrfToken} />
    </div>
  );
}
