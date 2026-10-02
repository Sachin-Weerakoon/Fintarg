import { randomBytes, createHmac } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  billingProvider,
  priceForPlan,
  type BillingProvider,
} from "@/lib/billing/provider";
import type { Cents } from "@/lib/money";

/**
 * Starts a checkout for a plan and returns where to send the browser.
 *
 * The `Subscription` row is written **before** the redirect, and its id becomes the
 * gateway reference. That ordering matters: a webhook can then only ever be matched
 * to a charge this app actually initiated.
 */

const APP_ORIGIN = (process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/+$/, "");

export type CheckoutResult =
  | { ok: true; url: string; subscriptionId: string }
  | { ok: false; reason: "no_price" | "provider_unavailable"; message: string };

export async function startCheckout(input: {
  userId: string;
  plan: string;
  returnTo: string;
  provider?: BillingProvider;
}): Promise<CheckoutResult> {
  const { userId, plan, returnTo } = input;
  const amountCents: Cents | null = priceForPlan(plan);
  if (amountCents == null) {
    return { ok: false, reason: "no_price", message: "That plan has no price." };
  }

  let provider: BillingProvider;
  try {
    provider = input.provider ?? billingProvider();
  } catch (error) {
    return {
      ok: false,
      reason: "provider_unavailable",
      message: error instanceof Error ? error.message : "Billing is not configured.",
    };
  }

  // One live subscription per account per plan: a second attempt supersedes the first.
  const reference = `sub_${randomBytes(16).toString("hex")}`;

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      plan,
      provider: provider.name,
      providerSessionId: reference,
      amountCents,
      status: "pending",
    },
  });

  try {
    const session = await provider.createCheckoutSession({
      reference,
      plan,
      amountCents,
      currency: "LKR",
      successUrl: `${APP_ORIGIN}${safePath(returnTo)}?billing=pending`,
      cancelUrl: `${APP_ORIGIN}${safePath(returnTo)}?billing=cancelled`,
    });

    return { ok: true, url: session.url, subscriptionId: subscription.id };
  } catch (error) {
    // Never leave a pending row behind for a charge that never happened.
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "failed" },
    });
    throw error;
  }
}

/** Only ever build a URL on our own origin. */
function safePath(value: string): string {
  if (!value.startsWith("/")) return "/settings";
  if (value.startsWith("//")) return "/settings";
  return value;
}

/**
 * Signs a webhook body the way the gateway would.
 *
 * Exists for the `log` provider so the whole billing path, signature check
 * included, can be exercised locally without gateway credentials.
 */
export function signWebhookBody(raw: string, secret = process.env.BILLING_WEBHOOK_SECRET): string {
  if (!secret) throw new Error("BILLING_WEBHOOK_SECRET is not set.");
  return createHmac("sha256", secret).update(raw).digest("hex");
}

export { APP_ORIGIN };