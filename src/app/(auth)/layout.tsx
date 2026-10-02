import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col bg-[#eef2f4] text-[#172a3d]">
      <header className="px-6 py-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f8d8e] text-body font-semibold text-white"
          >
            F
          </span>
          <span className="text-[2.1rem] font-semibold leading-none tracking-[-0.04em] text-[#1b2e3d]">Fintarg</span>
        </Link>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 pb-10">
        <div className="w-full max-w-[540px]">{children}</div>
      </main>

      <footer className="px-4 pb-8 text-center text-caption text-[#526272]">
        Your data stays private. Fintarg follows Sri Lanka&apos;s Personal Data Protection Act No. 9 of 2022.
      </footer>
    </div>
  );
}
