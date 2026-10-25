import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSubscriptionRow, getUserFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Opens Stripe's billing portal for the signed-in subscriber: cancel, switch plan, update the card,
 * download invoices. Pyrius never sees card details.
 */
export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Billing isn't set up." }, { status: 501 });
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Please sign in to manage billing." }, { status: 401 });
  try {
    const row = await getSubscriptionRow(user.id);
    if (!row?.stripe_customer_id) return NextResponse.json({ error: "There's no billing account for you yet. Choose a plan first." }, { status: 404 });
    const app = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const portal = await stripe<{ url: string }>("billing_portal/sessions", { customer: row.stripe_customer_id, return_url: `${app}/settings?section=subscription`, configuration: process.env.STRIPE_PORTAL_CONFIG });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error("Billing portal failed:", (err as Error).message);
    return NextResponse.json({ error: "The billing portal couldn't open. Please try again." }, { status: 502 });
  }
}
