import { AlertCircle } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Form field: label above, hint below, red error text + icon (UIX-001).
 * The error is linked with `aria-describedby` and the input marked
 * `aria-invalid`, so a screen reader announces the problem with the field.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
  suffix,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  suffix?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-small font-medium text-text">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1 font-normal text-text-muted">(optional)</span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-caption font-medium text-danger">
          <AlertCircle aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-text-muted">
          {hint}
        </p>
      ) : null}
      {suffix}
    </div>
  );
}

const CONTROL =
  "w-full min-h-touch rounded-input border bg-surface px-3 py-2 text-body text-text placeholder:text-text-muted/70 transition-colors focus:border-accent disabled:cursor-not-allowed disabled:bg-muted";

function describedBy(id: string, hint?: ReactNode, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

interface ValueAware<T> {
  /** Called with the control's current string value (live validation). */
  onValueChange?: (value: string) => void;
}

export function TextInput({
  id,
  hint,
  error,
  className,
  onValueChange,
  ...rest
}: { id: string; hint?: ReactNode; error?: string } & ValueAware<HTMLInputElement> & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      id={id}
      name={rest.name ?? id}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      className={cn(CONTROL, error ? "border-danger" : "border-border", className)}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...rest}
    />
  );
}

/**
 * Money input. `inputMode="decimal"` gives a numeric keypad on mobile
 * (UX rule: "amounts use numeric keypad on mobile").
 */
export function AmountInput({
  id,
  hint,
  error,
  className,
  onValueChange,
  ...rest
}: { id: string; hint?: ReactNode; error?: string } & ValueAware<HTMLInputElement> & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-small font-medium text-text-muted"
      >
        Rs.
      </span>
      <input
        id={id}
        name={rest.name ?? id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(CONTROL, "pl-10 tabular", error ? "border-danger" : "border-border", className)}
        onChange={(event) => onValueChange?.(event.target.value)}
        {...rest}
      />
    </div>
  );
}

export function SelectInput({
  id,
  hint,
  error,
  className,
  onValueChange,
  children,
  ...rest
}: { id: string; hint?: ReactNode; error?: string } & ValueAware<HTMLSelectElement> & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      id={id}
      name={rest.name ?? id}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      className={cn(CONTROL, "appearance-none pr-9", error ? "border-danger" : "border-border", className)}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...rest}
    >
      {children}
    </select>
  );
}

export function TextAreaInput({
  id,
  hint,
  error,
  className,
  onValueChange,
  ...rest
}: { id: string; hint?: ReactNode; error?: string } & ValueAware<HTMLTextAreaElement> & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      id={id}
      name={rest.name ?? id}
      rows={rest.rows ?? 4}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      className={cn(CONTROL, "min-h-24 resize-y", error ? "border-danger" : "border-border", className)}
      onChange={(event) => onValueChange?.(event.target.value)}
      {...rest}
    />
  );
}

export function CheckboxField({
  id,
  label,
  hint,
  defaultChecked,
  name,
}: {
  id: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  name?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name ?? id}
        type="checkbox"
        defaultChecked={defaultChecked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border border-border text-accent accent-[rgb(var(--c-accent))]"
      />
      <div>
        <label htmlFor={id} className="text-small font-medium text-text">
          {label}
        </label>
        {hint ? (
          <p id={`${id}-hint`} className="text-caption text-text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function FileField({
  id,
  hint,
  error,
  accept,
  name,
}: {
  id: string;
  hint?: ReactNode;
  error?: string;
  accept?: string;
  name?: string;
}) {
  return (
    <input
      id={id}
      name={name ?? "file"}
      type="file"
      accept={accept ?? ".pdf,.jpg,.jpeg,.png,.docx"}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      className={cn(
        "block w-full cursor-pointer rounded-input border border-border bg-surface text-small text-text file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-l-input file:border-0 file:bg-accent-soft file:px-4 file:py-2.5 file:text-small file:font-medium file:text-accent hover:file:bg-accent hover:file:text-accent-contrast",
        error && "border-danger",
      )}
    />
  );
}

export function FormGrid({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 }) {
  return (
    <div className={cn("grid gap-4", columns === 2 ? "sm:grid-cols-2" : "grid-cols-1")}>{children}</div>
  );
}
