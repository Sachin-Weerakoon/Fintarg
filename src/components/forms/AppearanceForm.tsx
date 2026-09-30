"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { FormField, SelectInput, TextInput } from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { updateAppearanceAction } from "@/app/(app)/settings/actions";
import { ACCENT_PRESETS, contrastOnWhite, ensureReadableOnWhite, isValidHex } from "@/lib/theme";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/validation";

const IDLE: FormState = { status: "idle" };

/**
 * FR-8: theme colour picker with presets plus a custom accent.
 *
 * The preview applies the candidate colour to real tokens immediately, and the
 * contrast readout tells the user in words when a colour had to be darkened -
 * the design rule is never silent about it.
 */
export function AppearanceForm({
  csrfToken,
  initial,
}: {
  csrfToken: string;
  initial: { themeAccent: string; themeMode: string; fontScale: string; density: string };
}) {
  const [state, formAction] = useActionState(updateAppearanceAction, IDLE);
  const [accentInput, setAccentInput] = useState(initial.themeAccent);
  const [mode, setMode] = useState(initial.themeMode);
  const [fontScale, setFontScale] = useState(initial.fontScale);
  const [density, setDensity] = useState(initial.density);

  const valid = isValidHex(accentInput);
  const effective = valid ? ensureReadableOnWhite(accentInput) : initial.themeAccent;
  const wasDarkened = valid && effective.toLowerCase() !== accentInput.toLowerCase();
  const ratio = contrastOnWhite(effective);
  const passes = ratio >= 4.5;
  const errors = state.status === "error" ? state.errors ?? {} : {};

  // Live preview on this card only, so the rest of the app is untouched until save.
  const previewStyle = {
    ["--preview-accent" as string]: hexToTriplet(effective),
  } as React.CSSProperties;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="_csrf" value={csrfToken} />
      <input type="hidden" name="themeAccent" value={valid ? effective : initial.themeAccent} />
      <input type="hidden" name="themeMode" value={mode} />
      <input type="hidden" name="fontScale" value={fontScale} />
      <input type="hidden" name="density" value={density} />

      <div aria-live="polite" className="sr-only">
        {state.status === "error" ? state.message : state.status === "success" ? state.message : ""}
      </div>

      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 rounded-input border border-danger/50 bg-danger-soft p-3 text-small text-danger">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="flex items-start gap-2 rounded-input border border-positive/50 bg-positive-soft p-3 text-small text-positive">
          <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium text-text">Theme colour</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {ACCENT_PRESETS.map((preset) => {
            const selected = effective.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setAccentInput(preset.hex)}
                aria-pressed={selected}
                className={cn(
                  "flex min-h-touch flex-col items-center justify-center gap-1 rounded-input border p-2 transition-colors",
                  selected ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-muted",
                )}
              >
                <span
                  aria-hidden
                  className="h-6 w-6 rounded-pill"
                  style={{ backgroundColor: preset.hex }}
                />
                <span className="text-caption text-text-muted">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <FormField
        id="custom-accent"
        label="Custom colour"
        hint="Use a hex code such as #1d4ed8. If white text would be hard to read, Fintarg darkens it automatically."
        error={errors.themeAccent ?? (accentInput && !valid ? "Use a colour like #1d4ed8" : undefined)}
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-11 w-11 shrink-0 rounded-input border border-border"
            style={{ backgroundColor: valid ? effective : "transparent" }}
          />
          <TextInput
            id="custom-accent"
            value={accentInput}
            onValueChange={setAccentInput}
            spellCheck={false}
            autoComplete="off"
            className="font-mono"
            placeholder="#0f766e"
          />
        </div>
      </FormField>

      <p className="flex items-center gap-2 text-caption text-text-muted">
        {passes ? (
          <>
            <Check aria-hidden className="h-3.5 w-3.5 text-positive" />
            White text on this colour passes the readability check ({ratio.toFixed(1)}:1).
          </>
        ) : null}
      </p>
      {wasDarkened ? (
        <p className="text-caption text-text-muted">
          We will use <span className="font-medium text-text">{effective}</span> instead, so white text stays
          readable.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="themeMode" label="Light or dark" required>
          <SelectInput id="themeMode" value={mode} onValueChange={setMode} name="themeMode-display">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">Match my device</option>
          </SelectInput>
        </FormField>
        <FormField id="fontScale" label="Text size" required>
          <SelectInput id="fontScale" value={fontScale} onValueChange={setFontScale} name="fontScale-display">
            <option value="small">Smaller</option>
            <option value="medium">Normal</option>
            <option value="large">Larger</option>
          </SelectInput>
        </FormField>
        <FormField id="density" label="Layout density" required>
          <SelectInput id="density" value={density} onValueChange={setDensity} name="density-display">
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </SelectInput>
        </FormField>
      </div>

      <div
        className="rounded-card border border-border p-3"
        style={{ ...previewStyle, backgroundColor: `rgb(var(--preview-accent) / 0.08)` }}
      >
        <p className="text-caption font-medium uppercase tracking-wide text-text-muted">Preview</p>
        <p
          className="mt-1 inline-flex min-h-touch items-center rounded-pill px-4 text-small font-medium text-white"
          style={{ backgroundColor: effective }}
        >
          Your buttons will look like this
        </p>
      </div>

      <div className="flex justify-end">
        <SubmitButton>Save appearance</SubmitButton>
      </div>
    </form>
  );
}

function hexToTriplet(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}
