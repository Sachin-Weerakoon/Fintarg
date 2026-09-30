import { describe, expect, it } from "vitest";
import {
  ACCENT_PRESETS,
  contrastOnWhite,
  contrastRatio,
  ensureReadableOnWhite,
  hexToRgb,
  isValidHex,
  normaliseHex,
  readableTextOn,
  relativeLuminance,
  rgbToHex,
  rgbToHsl,
} from "@/lib/theme";

describe("WCAG contrast maths", () => {
  it("computes the known ratios for black and white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#1d4ed8", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#1d4ed8"), 10);
  });
});

describe("ensureReadableOnWhite", () => {
  it("leaves an already-readable colour untouched", () => {
    expect(ensureReadableOnWhite("#0f766e")).toBe("#0f766e");
    expect(ensureReadableOnWhite("#1d4ed8")).toBe("#1d4ed8");
  });

  it("darkens a colour that fails 4.5:1 on white", () => {
    const dark = ensureReadableOnWhite("#ffe066");
    expect(dark).not.toBe("#ffe066");
    expect(contrastOnWhite(dark)).toBeGreaterThanOrEqual(4.5);
  });

  it("handles every awkward case without throwing", () => {
    for (const colour of ["#ffffff", "#000000", "#ffff00", "#00ff00", "#123456", "#abcdef", "#0000ff"]) {
      const result = ensureReadableOnWhite(colour);
      expect(isValidHex(result)).toBe(true);
      expect(contrastOnWhite(result)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("preserves hue while darkening", () => {
    const before = rgbToHsl(hexToRgb("#ffd400"));
    const after = rgbToHsl(hexToRgb(ensureReadableOnWhite("#ffd400")));
    // The colour must get darker, but stay recognisably the same hue.
    expect(after.l).toBeLessThan(before.l);
    expect(Math.abs(after.h - before.h)).toBeLessThan(3);
  });
});

describe("preset accents", () => {
  it("are all readable with white text", () => {
    for (const preset of ACCENT_PRESETS) {
      expect(contrastOnWhite(preset.hex), `${preset.label} fails the contrast check`).toBeGreaterThanOrEqual(4.5);
      expect(readableTextOn(preset.hex)).toBe("#ffffff");
    }
  });
});

describe("hex helpers", () => {
  it("expands three-digit hex and adds a missing hash", () => {
    expect(normaliseHex("abc")).toBe("#aabbcc");
    expect(normaliseHex("#AABBCC")).toBe("#aabbcc");
  });

  it("rejects nonsense", () => {
    expect(isValidHex("nope")).toBe(false);
    expect(isValidHex("#12")).toBe(false);
    expect(isValidHex("#1d4ed8")).toBe(true);
  });

  it("round-trips through rgb", () => {
    expect(rgbToHex(hexToRgb("#1d4ed8"))).toBe("#1d4ed8");
  });
});

describe("readableTextOn", () => {
  it("chooses dark text on a light background", () => {
    expect(readableTextOn("#ffe066")).toBe("#0f172a");
  });
});
