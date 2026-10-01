import type { Metadata } from "next";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { ResetPasswordForm } from "@/components/forms/PasswordResetForm";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const csrfToken = await ensureCsrfToken();
  return (
    <div>
      <h1 className="text-h1 font-semibold text-text">Choose a new password</h1>
      <p className="mt-1 mb-5 text-small text-text-muted">
        Setting a new password signs you out on every device.
      </p>
      <ResetPasswordForm csrfToken={csrfToken} token={token} />
    </div>
  );
}
