import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";

export function SignOutButton() {
  return (
    <form action={logoutAction} className="shrink-0">
      <button
        type="submit"
        className="inline-flex min-h-touch items-center gap-1.5 rounded-pill border border-border bg-surface px-3.5 py-2 text-small font-medium text-text transition-colors hover:bg-muted"
      >
        <LogOut aria-hidden className="h-4 w-4" />
        <span className="hidden sm:inline">Sign out</span>
        <span className="sr-only sm:hidden">Sign out</span>
      </button>
    </form>
  );
}
