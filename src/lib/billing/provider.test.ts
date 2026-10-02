import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  billingEnabled,
  billingProvider,
  priceForPlan,
  setBillingProvider,
  logProvider,
} from "@/lib/billing/provider";
import { signWebhookBody } from "@/lib/billing/checkout";

const ENV_KEYS = ["BILLING_PROVIDER", "BILLING_ENABLED", "BILLING_WEBHOOK_SECRET"] as const;
const saved: Record<string, string | undefined> = {};

function withEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) saved[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  setBillingProvider(null);
});

describe("priceForPlan", () => {
  it("prices business in integer cents", () => {
    // Rs. 2,500 stored as 250000 cents, never as a float rupee figure.
    expect(priceForPlan("business")).toBe(250_000);
    expect(Number.isInteger(priceForPlan("business"))).toBe(true);
  });

  it("has no price for basic, which is free", () => {
    expect(priceForPlan("basic")).toBeNull();
  });

  it("has no price for an unknown plan", () => {
    expect(priceForPlan("platinum")).toBeNull();
  });
});

describe("billingProvider", () => {
  it("defaults to the log provider", () => {
    withEnv({ BILLING_PROVIDER: undefined });
    expect(billingProvider().name).toBe("log");
  });

  it("refuses to fall back to log when an unimplemented provider is named", () => {
    // Silently treating Stripe as "log" would mean a real charge looks free.
    withEnv({ BILLING_PROVIDER: "stripe" });
    expect(() => billingProvider()).toThrow(/not implemented/i);
  });
});

describe("billingEnabled", () => {
  it("is off with the log provider", () => {
    withEnv({ BILLING_PROVIDER: "log" });
    expect(billingEnabled()).toBe(false);
  });

  it("is on when a real provider is named", () => {
    withEnv({ BILLING_PROVIDER: "payhere" });
    expect(billingEnabled()).toBe(true);
  });

  it("lets BILLING_ENABLED override the provider default", () => {
    withEnv({ BILLING_PROVIDER: "log", BILLING_ENABLED: "true" });
    expect(billingEnabled()).toBe(true);
    withEnv({ BILLING_PROVIDER: "payhere", BILLING_ENABLED: "false" });
    expect(billingEnabled()).toBe(false);
  });
});

describe("webhook signature verification", () => {
  const raw = JSON.stringify({ providerSessionId: "sub_abc", outcome: "paid" });

  it("accepts a correctly signed body", () => {
    withEnv({ BILLING_WEBHOOK_SECRET: "s3cret" });
    expect(
      logProvider.verifyWebhookSignature({ raw, signature: signWebhookBody(raw, "s3cret") }),
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    withEnv({ BILLING_WEBHOOK_SECRET: "s3cret" });
    const signature = createHmac("sha256", "s3cret").update(raw).digest("hex");
    const tampered = raw.replace('"paid"', '"free_forever"');
    expect(logProvider.verifyWebhookSignature({ raw: tampered, signature })).toBe(false);
  });

  it("rejects a missing signature", () => {
    withEnv({ BILLING_WEBHOOK_SECRET: "s3cret" });
    expect(logProvider.verifyWebhookSignature({ raw, signature: null })).toBe(false);
  });

  it("rejects the wrong secret", () => {
    withEnv({ BILLING_WEBHOOK_SECRET: "s3cret" });
    expect(
      logProvider.verifyWebhookSignature({ raw, signature: signWebhookBody(raw, "guess") }),
    ).toBe(false);
  });

  it("FAILS CLOSED when no secret is configured", () => {
    // This is the important one: an unset secret must reject, never accept.
    withEnv({ BILLING_WEBHOOK_SECRET: undefined });
    expect(logProvider.verifyWebhookSignature({ raw, signature: "anything" })).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    withEnv({ BILLING_WEBHOOK_SECRET: "s3cret" });
    expect(logProvider.verifyWebhookSignature({ raw, signature: "abc" })).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("reads a well-formed event", () => {
    const event = logProvider.parseWebhook(
      JSON.stringify({ providerSessionId: "sub_abc", outcome: "paid", providerPaymentId: "pay_1" }),
    );
    expect(event).toMatchObject({
      outcome: "paid",
      providerSessionId: "sub_abc",
      providerPaymentId: "pay_1",
    });
  });

  it("returns null for an outcome it does not handle", () => {
    expect(logProvider.parseWebhook(JSON.stringify({ providerSessionId: "s", outcome: "free" }))).toBeNull();
  });

  it("returns null without a session id", () => {
    expect(logProvider.parseWebhook(JSON.stringify({ outcome: "paid" }))).toBeNull();
  });

  it("returns null for junk rather than throwing", () => {
    expect(logProvider.parseWebhook("not json")).toBeNull();
    expect(logProvider.parseWebhook("")).toBeNull();
  });
});