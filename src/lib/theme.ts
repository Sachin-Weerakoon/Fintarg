/**
 * Theme colour utilities (Design System: "Custom theme colours must auto-check
 * >= 4.5:1 contrast against white text; darken if they fail").
 *
 * A user can type any hex value into the theme picker. Before it is persisted we
 * normalise it: if white text on the colour does not reach WCAG AA 4.5:1, the
 * colour is darkened until it does. The original choice is never rejected, so
 * the feature stays "colour carries meaning but never fails accessibility".
 */

export const MIN_CONTRAST_ON_WHITE = 4.5;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function isValidHex(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
}

export function normaliseHex(value: string): string {
  let hex = value.trim().toLowerCase();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  if (hex.length === 4) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (hex.length === 9) hex = hex.slice(0, 7);
  return hex;
}

export function hexToRgb(hex: string): Rgb {
  const clean = normaliseHex(hex);
  return {
    r: parseInt(clean.slice(1, 3), 16),
    g: parseInt(clean.slice(3, 5), 16),
    b: parseInt(clean.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return {
    r: Math.round((rgb[0] + m) * 255),
    g: Math.round((rgb[1] + m) * 255),
    b: Math.round((rgb[2] + m) * 255),
  };
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio between two colours, 1 - 21. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastOnWhite(hex: string): number {
  return contrastRatio("#ffffff", hex);
}

/**
 * Darken `hex` (preserving hue and saturation) until white text on it reaches
 * `minContrast`, then stop at the *lightest* such shade so the user's chosen
 * colour stays as close to their intent as accessibility allows.
 */
export function ensureReadableOnWhite(hex: string, minContrast = MIN_CONTRAST_ON_WHITE): string {
  const clean = normaliseHex(hex);
  if (contrastOnWhite(clean) >= minContrast) return clean;

  const hsl = rgbToHsl(hexToRgb(clean));
  // Contrast rises monotonically with lightness, so we binary search for the
  // boundary between "fails" and "passes" and keep the passing side.
  let passing = 0;
  let failing = hsl.l;

  for (let i = 0; i < 16; i += 1) {
    const mid = (passing + failing) / 2;
    if (contrastOnWhite(rgbToHex(hslToRgb({ ...hsl, l: mid }))) >= minContrast) {
      passing = mid;
    } else {
      failing = mid;
    }
  }

  // Black always passes 21:1, so an achromatic input simply resolves to the
  // darkest grey it needs rather than failing.
  return rgbToHex(hslToRgb({ ...hsl, l: passing }));
}

/** Pick the readable foreground for an arbitrary background. */
export function readableTextOn(hex: string): "#ffffff" | "#0f172a" {
  return contrastOnWhite(hex) >= MIN_CONTRAST_ON_WHITE ? "#ffffff" : "#0f172a";
}

export interface AccentPreset {
  id: string;
  label: string;
  /** Already normalised: white text passes 4.5:1 on every preset. */
  hex: string;
  soft: string;
}

function softTint(hex: string): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb({ h: hsl.h, s: Math.min(0.85, hsl.s), l: 0.94 }));
}

const PRESET_SEEDS: { id: string; label: string; hex: string }[] = [
  { id: "teal", label: "Teal", hex: "#0f766e" },
  { id: "indigo", label: "Indigo", hex: "#4338ca" },
  { id: "blue", label: "Blue", hex: "#1d4ed8" },
  { id: "green", label: "Green", hex: "#15803d" },
  { id: "violet", label: "Violet", hex: "#6d28d9" },
  { id: "rose", label: "Rose", hex: "#be123c" },
  { id: "amber", label: "Amber", hex: "#b45309" },
  { id: "slate", label: "Slate", hex: "#334155" },
];

export const ACCENT_PRESETS: AccentPreset[] = PRESET_SEEDS.map((seed) => {
  const hex = ensureReadableOnWhite(seed.hex);
  return { id: seed.id, label: seed.label, hex, soft: softTint(hex) };
});

export const DEFAULT_ACCENT = ACCENT_PRESETS[0];

export function presetById(id: string): AccentPreset | undefined {
  return ACCENT_PRESETS.find((preset) => preset.id === id);
}
