/**
 * Identifier handling for sign-up and sign-in (FR-1.1).
 *
 * An account is identified by an email address, a mobile number, or both. A
 * single text field accepts either, so the form can say "Email or mobile number"
 * and still decide which lookup to perform.
 *
 * Mobile numbers are normalised to the local `07XXXXXXXX` form so that
 * `0712345678`, `+94712345678` and `94712345678` cannot become three accounts.
 */

import { z } from "zod";

/** `0712345678` - ten digits starting 07, the format we store. */
const LOCAL_MOBILE = /^07[0-9]{8}$/;

/** Accepts the local form, `0…`, `+94…` or bare `94…`. Returns null if not a mobile. */
export function normaliseMobile(raw: string): string | null {
  const digits = raw.trim().replace(/[\s()-]/g, "");
  if (!digits) return null;

  if (/^\+94[0-9]{9}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^94[0-9]{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0[0-9]{9}$/.test(digits)) return digits;
  // Bare 9-digit local number, e.g. 712345678
  if (/^[0-9]{9}$/.test(digits) && digits.startsWith("7")) return `0${digits}`;

  return null;
}

export type IdentifierKind = "email" | "mobile";

export interface Identifier {
  kind: IdentifierKind;
  /** Normalised value: lowercase email, or `07XXXXXXXX`. */
  value: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Decide what the user typed. A string containing "@" is treated as an email. */
export function parseIdentifier(raw: string): Identifier | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes("@")) {
    const email = value.toLowerCase();
    return EMAIL_SHAPE.test(email) ? { kind: "email", value: email } : null;
  }
  const mobile = normaliseMobile(value);
  return mobile ? { kind: "mobile", value: mobile } : null;
}

export const identifierField = z
  .string()
  .trim()
  .min(1, "Enter your email or mobile number")
  .refine((value) => parseIdentifier(value) !== null, {
    message: "Enter a valid email address or mobile number (e.g. 0771234567)",
  });

/** Human label for an identifier, for logs and audit rows. */
export function describeIdentifier(identifier: Identifier | null, fallback = "unknown"): string {
  if (!identifier) return fallback;
  return identifier.kind === "email"
    ? identifier.value
    : `${identifier.value.slice(0, 4)}***${identifier.value.slice(-3)}`;
}

/** A name to show when the account has no full name. Never throws on a null email. */
export function displayNameFor(input: {
  fullName?: string | null;
  email?: string | null;
  mobile?: string | null;
}): string {
  const fullName = input.fullName?.trim();
  if (fullName) return fullName;
  if (input.email) return input.email.split("@")[0] ?? input.email;
  if (input.mobile) return input.mobile;
  return "there";
}