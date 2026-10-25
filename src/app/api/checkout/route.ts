import { NextResponse } from "next/server";
import { priceFor, stripe, StripeError } from "@/lib/stripe";
import { getSubscriptionRow, getUserFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Creates a Stripe Checkout session when Stripe is configured.
 * Without keys it returns { demo: true } and the UI shows a clearly labeled demo checkout.
 * The plan is only changed by the Stripe webhook after payment — never by the client.
 * Someone who already pays is sent to the billing portal instead, so nobody pays twice.
 */
export async function POST(req: Request) {
  const { plan, interval: rawInterval } = await req.json().catch(() => ({ plan: "" }));
  if (plan !== "plus" && plan !== "pro") return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  const interval = rawInterval === "year" ? "year" : "month";
  if (!process.env.STRIPE_SECRET_KEY || !priceFor(plan, "month")) return NextResponse.json({ demo: true });
  const price = priceFor(plan, interval);
  if (!price) return NextResponse.json({ error: "Annual billing isn't available yet. Choose monthly for now." }, { status: 400 });

  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Please sign in to upgrade." }, { status: 401 });

  const app = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const back = `${app}/settings?section=subscription`;
  try {
    const row = await getSubscriptionRow(user.id).catch(() => null);
    const paying = row?.stripe_subscription_id && row.plan !== "free" && row.status !== "canceled";
    if (paying && row?.stripe_customer_id) {
      // Plan changes for subscribers happen in the portal (prorated), not as a second subscription.
      const portal = await stripe<{ url: string }>("billing_portal/sessions", { customer: row.stripe_customer_id, return_url: back, configuration: process.env.STRIPE_PORTAL_CONFIG });
      return NextResponse.json({ url: portal.url, portal: true });
    }
    const session = await stripe<{ url: string }>("checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": 1,
      client_reference_id: user.id,
      "metadata[plan]": plan,
      "metadata[interval]": interval,
      "subscription_data[metadata][plan]": plan,
      "subscription_data[metadata][interval]": interval,
      "subscription_data[metadata][user_id]": user.id,
      // A returning customer keeps their Stripe customer (card, invoices); a new one is created from their email.
      ...(row?.stripe_customer_id ? { customer: row.stripe_customer_id } : { customer_email: user.email }),
      allow_promotion_codes: true,
      success_url: `${back}&checkout=success`,
      cancel_url: `${back}&checkout=cancelled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout failed:", (err as Error).message);
    return NextResponse.json({ error: err instanceof StripeError ? "Stripe couldn't start the checkout. Please try again." : "Checkout couldn't start." }, { status: 502 });
  }
}
