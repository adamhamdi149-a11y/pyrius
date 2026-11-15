import { NextResponse } from "next/server";
import { cleanFlightParams, gate } from "@/lib/apiGate";
import { startCheckout, type TravellerIn } from "@/lib/booking/flightCheckout";
import { cleanTraveller, travellerKinds } from "@/lib/booking/travellers";
import { duffelEnabled } from "@/lib/providers/duffel";
import { PROVIDER_STATUS, ProviderError } from "@/lib/providers/errors";
import { StripeError } from "@/lib/stripe";
import { getUserFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Prices the chosen fare with the travellers' details and opens Stripe Checkout for it.
 * If the price changed since the user saw it, returns the new fare so they can confirm it.
 */
export async function POST(req: Request) {
  if (!duffelEnabled() || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Booking in Pyrius isn't available yet.", code: "not_configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { params?: unknown; fareKey?: unknown; shownTotal?: unknown; offerId?: unknown; travellers?: unknown } | null;
  const params = cleanFlightParams(body?.params);
  const fareKey = typeof body?.fareKey === "string" && body.fareKey.length < 600 ? body.fareKey : null;
  const offerId = typeof body?.offerId === "string" && /^off_[A-Za-z0-9]{10,60}$/.test(body.offerId) ? body.offerId : undefined;
  const shownTotal = typeof body?.shownTotal === "number" && body.shownTotal > 0 ? body.shownTotal : null;
  if (!params || !fareKey || !shownTotal || !Array.isArray(body?.travellers)) return NextResponse.json({ error: "This fare can't be booked from here.", code: "bad_request" }, { status: 400 });
  const kinds = travellerKinds(params);
  if (body.travellers.length !== kinds.length) return NextResponse.json({ error: "Enter the details of every traveller.", code: "bad_request" }, { status: 400 });
  const travellers: TravellerIn[] = [];
  for (const [i, kind] of kinds.entries()) {
    const t = cleanTraveller(body.travellers[i], kind, params);
    if (typeof t === "string") return NextResponse.json({ error: t, code: "bad_request", traveller: i }, { status: 400 });
    travellers.push(t);
  }
  const g = await gate(req, "booking");
  if (g instanceof NextResponse) return g;
  const user = await getUserFromRequest(req);
  try {
    const out = await startCheckout({ params, fareKey, shownTotal, offerId, travellers, user: user ?? undefined, appUrl: new URL(req.url).origin });
    return NextResponse.json(out);
  } catch (err) {
    if (err instanceof ProviderError) {
      const msg = err.code === "expired" ? "These flights are no longer for sale at this fare. Pick another one." : "The airline didn't respond. Please try again.";
      return NextResponse.json({ error: msg, code: err.code }, { status: PROVIDER_STATUS[err.code] });
    }
    console.error("Flight checkout failed:", (err as Error).message);
    return NextResponse.json({ error: err instanceof StripeError ? "The payment page couldn't open. Please try again." : "The booking couldn't start. Please try again." }, { status: 502 });
  }
}
