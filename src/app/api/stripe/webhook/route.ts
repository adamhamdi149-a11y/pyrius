import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });
  const payload = await req.text();
  if (!verify(payload, req.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  const event = JSON.parse(payload);
  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const plan = s.metadata?.plan === "pro" ? "pro" : "plus";
      if (s.client_reference_id) {
        await upsertSubscription({
          user_id: s.client_reference_id,
          plan,
          status: "active",
          stripe_customer_id: s.customer,
          stripe_subscription_id: s.subscription,
        });
      }
    } else if (event.type === "customer.subscription.deleted") {
      await downgradeBySubscriptionId(event.data.object.id);
    }
  } catch (err) {
    console.error("Webhook handling failed:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
