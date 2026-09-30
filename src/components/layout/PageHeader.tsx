import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-h1 font-semibold text-text">{title}</h1>
        {description ? <p className="mt-1 text-small text-text-muted">{description}</p> : null}
      </div>
      {action ? <div className="no-print shrink-0">{action}</div> : null}
    </div>
  );
}
