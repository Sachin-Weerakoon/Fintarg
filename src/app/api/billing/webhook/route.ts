import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { billingProvider } from "@/lib/billing/provider";
import { planOf } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * Billing webhook: the only thing that can grant a paid plan.
 *
 * Three defences, in order:
 *   1. the signature is verified against `BILLING_WEBHOOK_SECRET` with a constant-time
 *      compare, and an unset secret means **reject**, not accept;
 *   2. the session id is matched against a `Subscription` row this app created, so a
 *      validly signed call for someone else's session still cannot touch this app;
 *   3. the plan is derived from our own stored row, never from the payload, so a
 *      tampered body cannot change *what* is bought.
 *
 * The response is always 200 once a request is genuinely from the gateway: replying
 * with an error makes the provider retry a payment that already succeeded.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature =
    request.headers.get("x-billing-signature") ?? request.headers.get("x-payhere-signature");

  let provider;
  try {
    provider = billingProvider();
  } catch {
    return NextResponse.json({ ok: false, error: "billing not configured" }, { status: 501 });
  }

  if (!provider.verifyWebhookSignature({ raw, signature })) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  const event = provider.parseWebhook(raw);
  if (!event) {
    // Genuinely from the gateway, but an outcome we do not handle. Acknowledge it so
    // it is not retried forever, and record nothing.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { providerSessionId: event.providerSessionId },
  });
  if (!subscription) {
    return NextResponse.json({ ok: true, ignored: true, reason: "unknown session" });
  }

  const now = new Date();

  switch (event.outcome) {
    case "paid": {
      if (subscription.status === "paid") {
        return NextResponse.json({ ok: true, alreadyApplied: true });
      }

      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "paid",
            paidAt: now,
            providerPaymentId: event.providerPaymentId ?? subscription.providerPaymentId,
          },
        }),
        // The edition comes from the stored plan, never from the request body.
        prisma.user.update({
          where: { id: subscription.userId },
          data: { edition: planOf(subscription.plan), plan: subscription.plan },
        }),
        prisma.auditLog.create({
          data: {
            userId: subscription.userId,
            action: "billing.paid",
            entityType: "subscription",
            meta: JSON.stringify({
              subscriptionId: subscription.id,
              plan: subscription.plan,
              amountCents: subscription.amountCents,
              provider: event.provider,
            }),
          },
        }),
      ]);

      return NextResponse.json({ ok: true, applied: "paid" });
    }

    case "refunded":
    case "cancelled": {
      if (subscription.status === "paid") {
        await prisma.$transaction([
          prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: event.outcome, cancelledAt: now },
          }),
          // Walk the plan back, but only down to Basic: never touch an admin's account.
          prisma.user.updateMany({
            where: { id: subscription.userId, role: { not: "admin" } },
            data: { edition: "basic", plan: "basic" },
          }),
          prisma.auditLog.create({
            data: {
              userId: subscription.userId,
              action: `billing.${event.outcome}`,
              entityType: "subscription",
              meta: JSON.stringify({ subscriptionId: subscription.id, plan: subscription.plan }),
            },
          }),
        ]);
      } else {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: event.outcome, cancelledAt: now },
        });
      }
      return NextResponse.json({ ok: true, applied: event.outcome });
    }

    case "failed":
    default: {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "failed" },
      });
      return NextResponse.json({ ok: true, applied: "failed" });
    }
  }
}