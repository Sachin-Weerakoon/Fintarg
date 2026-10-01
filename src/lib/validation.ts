import { z } from "zod";
import { isAllowedExtension, isAllowedMimeType, MAX_FILE_BYTES } from "@/lib/storage";
import { isValidHex } from "@/lib/theme";
import { identifierField } from "@/lib/identity";

/** Shared primitives - every form in the app validates with the same messages. */

const amountField = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .refine((value) => Number.isFinite(Number(value.replace(/[,\s]/g, "").replace(/^Rs\.?/i, ""))), {
    message: "Enter a valid amount",
  })
  .refine((value) => Number(value.replace(/[,\s]/g, "").replace(/^Rs\.?/i, "")) > 0, {
    message: "Amount must be more than zero",
  });

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((value) => (value ? value : undefined));

const dateField = z
  .string()
  .trim()
  .min(1, "Pick a date")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: "Pick a valid date" });

export const emailField = z
  .string()
  .trim()
  .min(1, "Enter your email")
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

export const passwordField = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Keep this under 128 characters")
  .refine((value) => /[a-zA-Z]/.test(value) && /[0-9]/.test(value), {
    message: "Include at least one letter and one number",
  });

const mobileField = z
  .string()
  .trim()
  .regex(/^(?:\+94|0)?7[0-9]{8}$/, "Enter a valid mobile number (e.g. 0771234567)");

const phoneField = z
  .string()
  .trim()
  .regex(/^(?:\+94|0)?[0-9]{9,10}$/, "Enter a valid phone number");

/* ----------------------------------------------------------------- accounts */

/** One field accepts either an email address or a mobile number (FR-1.1). */
export const identifierSchema = identifierField;

/**
 * PDPA No. 9 of 2022 (NFR-7): consent is recorded explicitly, with the version
 * of the notice that was agreed to.
 */
export const CONSENT_VERSION = "2026-01";

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  identifier: identifierField,
  password: passwordField,
  edition: z.enum(["basic", "business"]),
  consent: z.literal("on", {
    errorMap: () => ({ message: "Please accept the privacy notice to continue" }),
  }),
});

export const loginSchema = z.object({
  identifier: identifierField,
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  identifier: identifierField,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "That reset link is not valid"),
  password: passwordField,
  confirmPassword: z.string().min(1, "Type the new password again"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "The two passwords do not match",
  path: ["confirmPassword"],
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  mobile: z.union([mobileField, z.literal("")]).transform((v) => (v ? v : undefined)),
  email: emailField,
  address: optionalText(300),
  dateOfBirth: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Pick a valid date"),
  nicNumber: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^[0-9]{9}[vVxX]?$|^[0-9]{12}$/.test(value), "Enter a valid NIC number"),
  portfolioUrl: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https?:\/\/.+/.test(value), "Start the link with https://"),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60),
  relationship: optionalText(40),
  phone: phoneField,
  kind: z.enum(["personal", "family"]),
});

/* ------------------------------------------------------------------- finance */

export const incomeSchema = z.object({
  sourceName: z.string().trim().min(1, "Enter a name").max(60),
  kind: z.enum(["salary", "business", "other"]),
  amount: amountField,
  frequency: z.enum(["monthly", "one_time", "custom"]),
  date: dateField,
  recurring: z.coerce.boolean().default(false),
  customIntervalDays: z.coerce.number().int().min(1).max(365).optional(),
  notes: optionalText(200),
});

export const EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Utilities",
  "Personal/Enjoyment",
  "Medical",
  "Other",
] as const;

export const expenseSchema = z.object({
  date: dateField,
  amount: amountField,
  categoryName: z.string().trim().min(1, "Pick a category").max(40),
  note: optionalText(200),
  recurring: z.coerce.boolean().default(false),
  isMedical: z.coerce.boolean().default(false),
  isPersonal: z.coerce.boolean().default(false),
});

export const financePaymentSchema = z.object({
  lender: z.string().trim().min(1, "Enter the lender").max(60),
  description: z.string().trim().min(1, "Describe the payment").max(80),
  amount: amountField,
  dueDayOfMonth: z.coerce
    .number()
    .int()
    .min(1, "Day must be 1 or more")
    .max(31, "Day must be 31 or less"),
  monthsRemaining: z.coerce.number().int().min(0).max(600).optional(),
  startDate: dateField,
  active: z.coerce.boolean().default(true),
});

export const loanSchema = z.object({
  lender: z.string().trim().min(1, "Enter the lender").max(60),
  purpose: optionalText(120),
  principal: amountField,
  interestRatePct: z.coerce.number().min(0).max(100).default(0),
  method: z.enum(["flat", "reducing", "simple", "compound"]).default("reducing"),
  startDate: dateField,
  dueDate: z.string().optional(),
  remainingBalance: amountField,
  manualMonthlyInterest: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || Number(value.replace(/[,\s]/g, "")) >= 0, "Enter a valid amount"),
});

export const pawnedItemSchema = z.object({
  description: z.string().trim().min(1, "Describe the item").max(80),
  amountReceived: amountField,
  interestRatePct: z.coerce.number().min(0).max(100).default(0),
  monthlyInterest: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || Number(value.replace(/[,\s]/g, "")) >= 0, "Enter a valid amount"),
  nextInterestDueDate: z.string().optional(),
  redemptionDate: z.string().optional(),
  notes: optionalText(200),
});

export const savingsGoalSchema = z.object({
  name: z.string().trim().min(1, "Name this goal").max(60),
  targetAmount: amountField,
  endDate: z.string().optional(),
  mode: z.enum(["daily", "monthly"]).default("daily"),
  dailyAmount: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || Number(value.replace(/[,\s]/g, "")) >= 0, "Enter a valid amount"),
  monthlyTarget: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || Number(value.replace(/[,\s]/g, "")) >= 0, "Enter a valid amount"),
  note: optionalText(200),
});

export const contributionSchema = z.object({
  goalId: z.string().trim().min(1),
  amount: amountField,
  date: dateField,
  note: optionalText(120),
});

export const personalPlanSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Pick a month"),
  plannedAmount: amountField,
});

/* ----------------------------------------------------------------- advanced */

export const companySchema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(80),
  regNumber: optionalText(40),
  address: optionalText(300),
  phone: z.union([phoneField, z.literal("")]).transform((v) => (v ? v : undefined)),
  email: z.union([emailField, z.literal("")]).transform((v) => (v ? v : undefined)),
  accentColor: z
    .string()
    .optional()
    .refine((value) => !value || isValidHex(value), "Use a colour like #1d4ed8"),
});

export const agreementSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(80),
  otherParty: z.string().trim().min(1, "Enter the other party").max(80),
  companyId: z.string().optional(),
  startDate: dateField,
  endDate: dateField,
  value: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || Number(value.replace(/[,\s]/g, "")) > 0, "Enter a valid amount"),
  summary: optionalText(2000),
  status: z.enum(["draft", "active", "expired"]).default("draft"),
});

export const letterSchema = z.object({
  templateKey: z.enum(["bank", "offer", "personal", "company"]),
  companyId: z.string().optional(),
  title: z.string().trim().min(1, "Give this letter a title").max(80),
  recipientName: z.string().trim().min(1, "Enter a recipient").max(80),
  recipientAddress: optionalText(240),
  body: z.string().trim().min(1, "Write the letter body").max(4000),
  signOff: z.string().trim().max(80).optional(),
});

/* ------------------------------------------------------------------ medical */

export const medicalRecordSchema = z.object({
  kind: z.enum(["expense", "appointment", "medication"]),
  date: dateField,
  title: z.string().trim().min(1, "Enter a title").max(80),
  provider: optionalText(80),
  amount: z
    .string()
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => !value || Number(value.replace(/[,\s]/g, "")) > 0, "Enter a valid amount"),
  notes: optionalText(1000),
  nextDoseAt: z.string().optional(),
});

/* ------------------------------------------------------------------- vault */

export const documentSchema = z.object({
  category: z.enum(["profile", "cv", "nic", "bank", "medical", "other", "letter", "agreement"]),
  label: z.string().trim().min(1, "Give this file a label").max(80),
  note: optionalText(200),
  sensitivity: z.enum(["standard", "sensitive", "restricted"]).default("standard"),
});

/* ----------------------------------------------------------------- settings */

export const appearanceSchema = z.object({
  themeAccent: z.string().refine(isValidHex, "Use a colour like #1d4ed8"),
  themeMode: z.enum(["light", "dark", "system"]),
  fontScale: z.enum(["small", "medium", "large"]),
  density: z.enum(["comfortable", "compact"]),
});

export const fileField = z
  .instanceof(File, { message: "Choose a file" })
  .refine((file) => file.size > 0, "The file is empty")
  .refine((file) => file.size <= MAX_FILE_BYTES, "Files must be 10 MB or smaller")
  .refine((file) => isAllowedMimeType(file.type), "Use PDF, JPG, PNG or DOCX")
  .refine((file) => isAllowedExtension(file.name), "Use a PDF, JPG, PNG or DOCX file");

export type FieldErrors = Record<string, string | undefined>;

export function flattenErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

export type FormState =
  | { status: "idle" }
  | { status: "error"; message: string; errors?: FieldErrors }
  | { status: "success"; message: string };
