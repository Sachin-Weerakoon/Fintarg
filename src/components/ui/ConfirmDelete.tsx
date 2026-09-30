"use client";

import { useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Confirm dialog (UIX-001): always shown before deleting financial records,
 * goals, documents and agreements. It wraps the destructive server action in a
 * plain <form>, so the action still runs through the normal POST + CSRF path.
 *
 * Uses the native <dialog> element for free focus trapping and Escape handling.
 */
export function ConfirmDelete({
  action,
  hiddenFields,
  label = "Delete",
  title = "Delete this record?",
  description = "This cannot be undone.",
  confirmLabel = "Yes, delete",
  className,
  variant = "danger",
  icon,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: Record<string, string | number | undefined>;
  label?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  className?: string;
  variant?: "danger" | "ghost" | "secondary";
  icon?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
        className={buttonClass({ variant, size: "sm", className: cn("gap-1.5", className) })}
        aria-haspopup="dialog"
      >
        {icon ?? <Trash2 aria-hidden className="h-4 w-4" />}
        {label}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        aria-labelledby="confirm-delete-title"
        className={cn(
          "m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-0 text-text shadow-raised backdrop:bg-black/50",
          open && "animate-slide-up",
        )}
      >
        <div className="p-5">
          <h2 id="confirm-delete-title" className="text-h2 font-medium">
            {title}
          </h2>
          <p className="mt-2 text-small text-text-muted">{description}</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                dialogRef.current?.close();
                setOpen(false);
              }}
              className={buttonClass({ variant: "secondary", size: "md" })}
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              className={buttonClass({ variant: "danger", size: "md" })}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
        {/* A function `action` must not also carry method="post": React warns
            and handles the submission itself. The CSRF token still travels in
            the hidden fields below. */}
        <form ref={formRef} action={action} className="hidden">
          {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={String(value ?? "")} />
          ))}
        </form>
      </dialog>
    </>
  );
}
