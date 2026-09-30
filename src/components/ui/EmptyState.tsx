import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Empty state: friendly line + one primary button (UIX-001). Empty states are
 * never blank - they always explain what this screen is for.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className={cn(
            "flex items-center justify-center rounded-pill bg-accent-soft text-accent",
            compact ? "h-10 w-10" : "h-14 w-14",
          )}
        >
          {icon}
        </span>
      ) : null}
      <div className="max-w-sm">
        <p className={cn("font-medium text-text", compact ? "text-small" : "text-h2")}>{title}</p>
        <p className="mt-1 text-small text-text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
