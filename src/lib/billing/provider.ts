import { createHmac, timingSafeEqual } from "node:crypto";
import { planOf, type Edition } from "@/lib/plans";
import type { Cents } from "@/lib/money";

/**
 * Provider-agnostic billing (FR-15 upgrade path).
 *
 * The app takes no new runtime dependency, so there is no Stripe SDK. Instead there
 * are exactly three things a gateway has to be able to do, and one function per
 * gateway. Swapping in a real provider means implementing `BillingProvider`.
 *
 * The rule that matters most: **the plan is moved by the webhook, never by the
 * browser.** A user can walk away from checkout, replay a success URL, or hand-edit
 * a query string. None of that may grant a paid plan. `verifyWebhookSignature` is the
 * gate, and a missing `BILLING_WEBHOOK_SECRET` fails closed rather than trusting an
 * unsigned call.
 */

export type BillingProviderName = "log" | "stripe" | "payhere" | string;

export interface CheckoutSession {
  /** Where to send the browser to pay. */
  url: string;
  /** Opaque id the gateway will echo back on the webhook. */
  providerSessionId: string;
  amountCents: Cents;
  currency: string;
}

export interface WebhookEvent {
  provider: BillingProviderName;
  /** "paid" | "failed" | "cancelled" | "refunded" */
  outcome: "paid" | "failed" | "cancelled" | "refunded";
  providerSessionId: string;
  providerPaymentId?: string;
  /** Raw body, so an unknown outcome is ignored rather than guessed at. */
  raw: string;
}

export interface BillingProvider {
  name: BillingProviderName;
  /** Creates a checkout session for one plan charge. */
  createCheckoutSession(input: {
    reference: string;
    plan: string;
    amountCents: Cents;
    currency: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession>;
  /**
   * Constant-time check that this webhook really came from the gateway.
   * Must return false when the signature is absent or wrong.
   */
  verifyWebhookSignature(input: { raw: string; signature: string | null }): boolean;
  /** Parses the raw body into an event. */
  parseWebhook(raw: string): WebhookEvent | null;
}

/* ------------------------------------------------------------------ pricing */

/**
 * Plan prices in LKR cents.
 *
 * Hard-coded here rather than in the database so the amount charged can never be
 * influenced by anything a user or an admin can write. Changing a price is a code
 * change, on purpose.
 */
export const PLAN_PRICES: Record<Exclude<Edition, "basic">, Cents> = {
  business: 2_500_00, // Rs. 2,500 a month
};

export function priceForPlan(plan: string): Cents | null {
  return (PLAN_PRICES as Record<string, Cents>)[plan] ?? null;
}

/* ------------------------------------------------------------- the "log" provider */

const logProvider: BillingProvider = {
  name: "log",

  async createCheckoutSession(input) {
    // No gateway: the URL simply goes nowhere, and the flow is completed by hand with
    // the local `simulatePayment` helper. This keeps the whole billing path - including
    // the webhook signature check - exercisable end to end without credentials.
    return {
      url: input.cancelUrl,
      providerSessionId: input.reference,
      amountCents: input.amountCents,
      currency: input.currency,
    };
  },

  verifyWebhookSignature({ raw, signature }) {
    const secret = process.env.BILLING_WEBHOOK_SECRET;
    if (!secret) return false; // fail closed
    if (!signature) return false;
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    return safeEqualHex(signature, expected);
  },

  parseWebhook(raw) {
    try {
      const body = JSON.parse(raw) as Record<string, string>;
      if (!body.providerSessionId) return null;
      const outcome = body.outcome;
      if (outcome !== "paid" && outcome !== "failed" && outcome !== "cancelled" && outcome !== "refunded") {
        return null;
      }
      return {
        provider: "log",
        outcome,
        providerSessionId: body.providerSessionId,
        providerPaymentId: body.providerPaymentId,
        raw,
      };
    } catch {
      return null;
    }
  },
};

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/* ------------------------------------------------------------- provider choice */

let override: BillingProvider | null = null;

/** Test seam: inject a provider without touching the environment. */
export function setBillingProvider(provider: BillingProvider | null): void {
  override = provider;
}

export function billingProvider(): BillingProvider {
  if (override) return override;
  const configured = (process.env.BILLING_PROVIDER ?? "log").toLowerCase();
  switch (configured) {
    case "log":
      return logProvider;
    // A named provider with no implementation yet must not silently fall through to
    // the log provider and pretend a payment happened.
    default:
      throw new Error(
        `BILLING_PROVIDER="${configured}" is not implemented. Implement a BillingProvider in src/lib/billing/provider.ts, or set BILLING_PROVIDER=log.`,
      );
  }
}

/** True when a real gateway is configured, i.e. the upgrade should require payment. */
export function billingEnabled(): boolean {
  if (process.env.BILLING_ENABLED === "false") return false;
  if (process.env.BILLING_ENABLED === "true") return true;
  // Default: real gateway configured means billing is live.
  return (process.env.BILLING_PROVIDER ?? "log").toLowerCase() !== "log";
}

export { logProvider, planOf };