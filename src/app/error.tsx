"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Replace with your error reporting service in production.
    console.error("Fintarg error", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-h1 font-semibold text-text">Something went wrong</h1>
      <p className="max-w-sm text-small text-text-muted">
        Your data is safe. Try again, and if it keeps happening go back to Home and check your entries.
      </p>
      {error.digest ? <p className="text-caption text-text-muted">Reference: {error.digest}</p> : null}
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
