/**
 * Money helpers.
 *
 * Every amount in Fintarg is an integer number of LKR *cents* (1 rupee = 100
 * cents). Integer arithmetic keeps the monthly analysis exact - no floating
 * point drift ever reaches a user-visible total.
 */

export type Cents = number;

const RUPEE = "Rs.";

/** Convert a rupee value (possibly negative, possibly fractional) to cents. */
export function rupeesToCents(rupees: number): Cents {
  return Math.round(rupees * 100);
}

/** Convert cents to a rupee number (float, only for display or input fields). */
export function centsToRupees(cents: Cents): number {
  return cents / 100;
}

function groupDigits(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Format cents for display: `Rs. 50,000`.
 *
 * The specification asks for `Rs. 50,000`, so whole-rupee amounts print without
 * decimals; only genuine paisa show them. Negative values render as
 * `Rs. -5,000` so the minus sign always sits next to the digits, which keeps the
 * currency marker stable and screen-reader friendly.
 */
export function formatMoney(cents: Cents, options: { showSign?: boolean } = {}): string {
  if (!Number.isFinite(cents)) return `${RUPEE} 0`;
  const negative = cents < 0;
  const absolute = Math.abs(Math.round(cents));
  const whole = groupDigits(String(Math.floor(absolute / 100)));
  const fraction = String(absolute % 100).padStart(2, "0");
  const sign = negative ? "-" : options.showSign ? "+" : "";
  const decimals = absolute % 100 === 0 ? "" : `.${fraction}`;
  return `${RUPEE} ${sign}${whole}${decimals}`;
}

/** Whole-rupee display used on the dashboard headline: `Rs. 50,000`. */
export function formatRupees(rupees: number, options: { showSign?: boolean } = {}): string {
  if (!Number.isFinite(rupees)) return `${RUPEE} 0`;
  const negative = rupees < 0;
  const absolute = Math.abs(Math.round(rupees * 100));
  const whole = groupDigits(String(Math.floor(absolute / 100)));
  const sign = negative ? "-" : options.showSign ? "+" : "";
  return `${RUPEE} ${sign}${whole}`;
}

/** Compact form for dense lists and chart axes: `Rs. 50k`. */
export function formatMoneyCompact(cents: Cents): string {
  const rupees = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  if (rupees >= 1_000_000) return `${RUPEE} ${sign}${trimZero(rupees / 1_000_000)}M`;
  if (rupees >= 1_000) return `${RUPEE} ${sign}${trimZero(rupees / 1_000)}k`;
  return `${RUPEE} ${sign}${Math.round(rupees)}`;
}

function trimZero(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

/** Strip formatting and read a user-typed amount. Returns null when invalid. */
export function parseAmountToCents(input: string | number): Cents | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? rupeesToCents(input) : null;
  }
  const cleaned = input.replace(/[,\s]/g, "").replace(/^Rs\.?/i, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return rupeesToCents(value);
}

/** Value of an `<input type="number">` for editing a cents amount. */
export function centsToInputValue(cents: Cents): string {
  return cents === 0 ? "" : (cents / 100).toFixed(2);
}

export function sum(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}

/** Sum of positive values only - used where negative adjustments must not count. */
export function sumPositive(values: Cents[]): Cents {
  return values.reduce((total, value) => total + (value > 0 ? value : 0), 0);
}

export function percent(part: number, whole: number): number {
  if (whole <= 0) return part > 0 ? 100 : 0;
  return Math.round((part / whole) * 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
