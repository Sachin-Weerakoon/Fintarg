"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** Submit button with a pending state, so slow saves never look like failures. */
export function SubmitButton({
  children,
  className,
  variant = "primary",
  size = "md",
  pendingLabel = "Saving...",
  ...rest
}: Omit<ButtonProps, "type"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending || rest.disabled}
      aria-busy={pending}
      className={cn(className)}
      {...rest}
    >
      {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}
