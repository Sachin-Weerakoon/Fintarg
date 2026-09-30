import type { Metadata } from "next";
import { ensureCsrfToken } from "@/lib/auth/csrf";
import { LoginForm } from "@/components/forms/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const csrfToken = await ensureCsrfToken();
  return (
    <div>
      <h1 className="text-h1 font-semibold text-text">Welcome back</h1>
      <p className="mt-1 mb-5 text-small text-text-muted">
        Sign in to see whether you can make it this month.
      </p>
      <LoginForm csrfToken={csrfToken} />
    </div>
  );
}
