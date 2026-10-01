"use client";

import { useActionState, useId, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  AmountInput,
  CheckboxField,
  FileField,
  FormField,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { FormState } from "@/lib/validation";
import { cn } from "@/lib/cn";

export type FieldSpec = {
  name: string;
  label: string;
  type: "text" | "password" | "amount" | "date" | "month" | "number" | "select" | "textarea" | "checkbox" | "file";
  options?: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
  defaultValue?: string;
  checked?: boolean;
  placeholder?: string;
  /** "amount" fields use a numeric keypad on mobile; "number" ones allow negatives. */
  min?: string;
  max?: string;
  step?: string;
  span?: 1 | 2;
  accept?: string;
  rows?: number;
  readOnly?: boolean;
  /** Password fields only: the right value keeps browser password managers useful. */
  autoComplete?: "current-password" | "new-password";
};

const IDLE: FormState = { status: "idle" };

/**
 * The single form primitive used by every create/edit screen.
 *
 * - `useActionState` gives server-side validation errors back on the same page
 * - errors are shown inline on the field *and* summarised at the top for screen
 *   reader users, with a live region so the summary is announced
 * - light client-side checks run on blur so forms "validate live" (UX rule)
 */
export function RecordForm({
  action,
  fields,
  submitLabel = "Save",
  pendingLabel = "Saving...",
  encType,
  idPrefix,
  footer,
  successMessage,
  csrfToken,
  className,
  hidden,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields: FieldSpec[];
  submitLabel?: string;
  pendingLabel?: string;
  encType?: "multipart/form-data";
  idPrefix?: string;
  footer?: React.ReactNode;
  successMessage?: string;
  csrfToken?: string;
  className?: string;
  /** Values carried in the POST but not shown, e.g. which plan is being chosen. */
  hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, IDLE);
  const generatedId = useId();
  const prefix = idPrefix ?? generatedId;
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});

  const serverErrors = state.status === "error" ? state.errors ?? {} : {};
  const liveErrors = validateLocally(fields, values, touched);
  // React manages encType itself for function actions and warns if we also set
  // it, so only opt in where a form genuinely uploads a file.
  const resolvedEncType = fields.some((field) => field.type === "file") ? "multipart/form-data" : undefined;

  const onFieldChange = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setTouched((current) => ({ ...current, [name]: true }));
  };
  const onFieldBlur = (name: string) => setTouched((current) => ({ ...current, [name]: true }));

  const errorEntries = Object.entries(serverErrors).filter(([, message]) => Boolean(message));

  return (
    <form action={formAction} encType={resolvedEncType ?? encType} className={cn("flex flex-col gap-4", className)} noValidate>
      {csrfToken ? <input type="hidden" name="_csrf" value={csrfToken} /> : null}
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}
      <div aria-live="polite" className="sr-only">
        {state.status === "error" ? state.message : ""}
        {state.status === "success" ? state.message : ""}
      </div>

      {state.status === "error" ? (
        <div role="alert" className="rounded-card border border-danger/50 bg-danger-soft p-3">
          <p className="flex items-center gap-2 text-small font-medium text-danger">
            <AlertCircle aria-hidden className="h-4 w-4" />
            {state.message}
          </p>
          {errorEntries.length ? (
            <ul className="mt-1 list-inside list-disc text-caption text-text-muted">
              {errorEntries.map(([field, message]) => (
                <li key={field}>
                  <span className="font-medium">{labelFor(fields, field)}</span>: {message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {state.status === "success" ? (
        <div role="status" className="rounded-card border border-positive/50 bg-positive-soft p-3">
          <p className="flex items-center gap-2 text-small font-medium text-positive">
            <CheckCircle2 aria-hidden className="h-4 w-4" />
            {state.message}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const id = `${prefix}-${field.name}`;
          const error = serverErrors[field.name] ?? (touched[field.name] ? liveErrors[field.name] : undefined);
          const span = field.span === 2 ? "sm:col-span-2" : "";

          if (field.type === "checkbox") {
            return (
              <div key={field.name} className={cn("sm:col-span-2", span)}>
                <CheckboxField
                  id={id}
                  name={field.name}
                  label={field.label}
                  hint={field.hint}
                  defaultChecked={field.checked}
                />
                {error ? (
                  <p className="mt-1 text-caption font-medium text-danger">{error}</p>
                ) : null}
              </div>
            );
          }

          return (
            <FormField
              key={field.name}
              id={id}
              label={field.label}
              hint={field.hint}
              error={error}
              required={field.required}
              className={span}
            >
              {renderControl(field, id, {
                onBlur: () => onFieldBlur(field.name),
                onValueChange: (value) => onFieldChange(field.name, value),
              })}
            </FormField>
          );
        })}
      </div>

      {footer}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>

      {successMessage && state.status === "success" ? (
        <p className="text-caption text-text-muted">{successMessage}</p>
      ) : null}
    </form>
  );
}

function renderControl(
  field: FieldSpec,
  id: string,
  handlers: { onBlur: () => void; onValueChange: (value: string) => void },
) {
  const common = {
    id,
    name: field.name,
    hint: field.hint,
    defaultValue: field.defaultValue,
    required: field.required,
    placeholder: field.placeholder,
    readOnly: field.readOnly,
    onBlur: handlers.onBlur,
    onValueChange: handlers.onValueChange,
  };

  switch (field.type) {
    case "amount":
      return <AmountInput {...common} />;
    case "date":
      return <TextInput {...common} type="date" />;
    case "month":
      return <TextInput {...common} type="month" />;
    case "number":
      return (
        <TextInput
          {...common}
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.step ?? "any"}
        />
      );
    case "select":
      return (
        <SelectInput {...common} defaultValue={field.defaultValue}>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      );
    case "textarea":
      return <TextAreaInput {...common} rows={field.rows ?? 4} />;
    case "password":
      // B11: masked, never echoed back into the page.
      return <TextInput {...common} type="password" autoComplete={field.autoComplete} />;
    case "file":
      return <FileField id={id} name={field.name} hint={field.hint} accept={field.accept} />;
    default:
      return <TextInput {...common} type="text" />;
  }
}

/**
 * Light on-blur checks so forms feel alive before the server round-trip.
 * Server validation stays the source of truth; these never block a save.
 */
function validateLocally(
  fields: FieldSpec[],
  values: Record<string, string>,
  touched: Record<string, boolean>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (!touched[field.name]) continue;
    const value = (values[field.name] ?? "").trim();

    if (field.required && value === "") {
      errors[field.name] = "This one is needed";
      continue;
    }
    if (value === "") continue;

    if (field.type === "amount") {
      const numeric = Number(value.replace(/[,\s]/g, "").replace(/^Rs\.?/i, ""));
      if (!Number.isFinite(numeric)) errors[field.name] = "Use numbers only, like 25000";
      else if (numeric <= 0) errors[field.name] = "Amount must be more than zero";
      continue;
    }

    if (field.type === "number") {
      if (!Number.isFinite(Number(value))) errors[field.name] = "Use numbers only";
      continue;
    }

    if (field.type === "date" && Number.isNaN(new Date(value).getTime())) {
      errors[field.name] = "Pick a valid date";
      continue;
    }

    if (field.type === "text" && /@/.test(field.name) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field.name] = "Enter a valid email address";
    }
  }

  return errors;
}

function labelFor(fields: FieldSpec[], name: string): string {
  return fields.find((field) => field.name === name)?.label ?? name;
}
