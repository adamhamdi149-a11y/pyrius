import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { entitlementFor, stripe, type StripeSubscription } from "@/lib/stripe";
import { downgradeBySubscriptionId, upsertSubscription } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Verifies Stripe's signature header (t=…,v1=…) without the SDK. */
function verify(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

/**
 * Records what Stripe says about a subscription right now. Every event re-reads the subscription
 * from Stripe, so events that arrive late, twice or out of order still end in the right plan.
 */
async function sync(subscriptionId: string, fallbackUserId?: string) {
  const sub = await stripe<StripeSubscription>(`subscriptions/${encodeURIComponent(subscriptionId)}`);
  const userId = sub.metadata?.user_id || fallbackUserId;
  const { plan, status } = entitlementFor(sub);
  if (!userId) {
    // Not created by Pyrius checkout (no user attached): only ever downgrade by id.
    if (plan === "free") await downgradeBySubscriptionId(sub.id);
    return;
  }
  await upsertSubscription({ user_id: userId, plan, status, stripe_customer_id: sub.customer, stripe_subscription_id: sub.id });
}

const SUBSCRIPTION_EVENTS = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed"]);

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });
  const payload = await req.text();
  if (!verify(payload, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(payload);
  const obj = event.data?.object ?? {};
  try {
    if (event.type === "checkout.session.completed" && obj.mode === "subscription" && obj.subscription) {
      await sync(obj.subscription, obj.client_reference_id ?? undefined);
    } else if (SUBSCRIPTION_EVENTS.has(event.type) && obj.id) {
      await sync(obj.id);
    } else if ((event.type === "invoice.payment_failed" || event.type === "invoice.paid") && obj.subscription) {
      await sync(obj.subscription);
    }
  } catch (err) {
    // A non-2xx makes Stripe retry the event later.
    console.error("Webhook handling failed:", event.type, (err as Error).message);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
