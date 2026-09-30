import type { Metadata } from "next";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { RegisterForm } from "@/components/forms/AuthForm";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  const csrfToken = await ensureCsrfToken();
  return (
    <div>
      <h1 className="text-h1 font-semibold text-text">Create your account</h1>
      <p className="mt-1 mb-5 text-small text-text-muted">
        One number, every month: what is left after everything.
      </p>
      <RegisterForm csrfToken={csrfToken} />
    </div>
  );
}
