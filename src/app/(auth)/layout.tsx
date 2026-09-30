import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="px-4 py-5">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-pill bg-accent text-body font-semibold text-accent-contrast"
          >
            F
          </span>
          <span className="text-h2 font-semibold text-text">Fintarg</span>
        </Link>
      </header>

      <main id="main" className="flex flex-1 items-start justify-center px-4 pb-10 sm:items-center">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="px-4 pb-8 text-center text-caption text-text-muted">
        Your data stays private. Fintarg follows Sri Lanka&apos;s Personal Data Protection Act No. 9 of 2022.
      </footer>
    </div>
  );
}
