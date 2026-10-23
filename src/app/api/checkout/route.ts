import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Creates a Stripe Checkout session when Stripe is configured.
 * Without keys it returns { demo: true } and the UI shows a clearly labeled demo checkout.
 * The plan is only changed by the Stripe webhook after payment — never by the client.
 */
export async function POST(req: Request) {
  const { plan } = await req.json().catch(() => ({ plan: "" }));
  if (plan !== "plus" && plan !== "pro") return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  const key = process.env.STRIPE_SECRET_KEY;
  const price = plan === "plus" ? process.env.STRIPE_PRICE_PLUS : process.env.STRIPE_PRICE_PRO;
  if (!key || !price) return NextResponse.json({ demo: true });

  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Please sign in to upgrade." }, { status: 401 });

  const app = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const form = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    "metadata[plan]": plan,
    "subscription_data[metadata][plan]": plan,
    "subscription_data[metadata][user_id]": user.id,
    success_url: `${app}/settings?section=subscription&checkout=success`,
    cancel_url: `${app}/settings?section=subscription&checkout=cancelled`,
  });
  if (user.email) form.set("customer_email", user.email);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ error: data.error?.message ?? "Stripe error" }, { status: 502 });
  return NextResponse.json({ url: data.url });
}
