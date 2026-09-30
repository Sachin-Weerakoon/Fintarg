import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
  tone = "default",
  id,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "warning" | "danger" | "positive" | "accent";
  id?: string;
  as?: "section" | "div" | "article" | "li";
}) {
  const tones = {
    default: "border-border",
    warning: "border-warning/60 bg-warning-soft/40",
    danger: "border-danger/60 bg-danger-soft/40",
    positive: "border-positive/50 bg-positive-soft/40",
    accent: "border-accent/40 bg-accent-soft/40",
  } as const;

  return (
    <Tag id={id} className={cn("card p-card", tones[tone], className)}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  id,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-h2 font-medium text-text">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 text-small text-text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="text-h2 font-medium text-text">{children}</h2>
      {hint ? <p className="mt-1 text-small text-text-muted">{hint}</p> : null}
    </div>
  );
}
