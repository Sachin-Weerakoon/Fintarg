import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertLevel = "info" | "success" | "warning" | "danger";

const STYLES: Record<AlertLevel, { wrap: string; icon: ReactNode; label: string }> = {
  info: {
    wrap: "border-info/40 bg-info-soft text-text",
    icon: <Info aria-hidden className="h-5 w-5 shrink-0 text-info" />,
    label: "Note",
  },
  success: {
    wrap: "border-positive/40 bg-positive-soft text-text",
    icon: <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0 text-positive" />,
    label: "Good",
  },
  warning: {
    wrap: "border-warning/50 bg-warning-soft text-text",
    icon: <AlertTriangle aria-hidden className="h-5 w-5 shrink-0 text-warning" />,
    label: "Careful",
  },
  danger: {
    wrap: "border-danger/50 bg-danger-soft text-text",
    icon: <XCircle aria-hidden className="h-5 w-5 shrink-0 text-danger" />,
    label: "Problem",
  },
};

/**
 * Alert banner: warning tint + icon + one sentence + one action (UIX-001).
 * Colour never travels alone - the icon and the level word carry the meaning
 * for colour-blind and screen-reader users.
 */
export function AlertBanner({
  level = "warning",
  title,
  message,
  actionLabel,
  actionHref,
  action,
  className,
  role,
}: {
  level?: AlertLevel;
  title?: string;
  message: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  action?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const style = STYLES[level];
  return (
    <div
      className={cn("flex flex-col gap-3 rounded-card border p-4 sm:flex-row sm:items-center", style.wrap, className)}
      role={role ?? (level === "danger" || level === "warning" ? "alert" : "status")}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {style.icon}
        <div className="min-w-0">
          <p className="text-small font-medium">
            <span className="sr-only">{style.label}: </span>
            {title}
          </p>
          <p className="mt-0.5 text-small text-text-muted">{message}</p>
        </div>
      </div>
      {action ??
        (actionLabel && actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex min-h-touch shrink-0 items-center justify-center rounded-pill border border-current/20 bg-surface px-4 py-2 text-small font-medium text-text transition-colors hover:bg-muted"
          >
            {actionLabel}
          </Link>
        ) : null)}
    </div>
  );
}
