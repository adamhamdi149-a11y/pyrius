import { NextResponse } from "next/server";
import { cleanFlightParams, gate } from "@/lib/apiGate";
import { flightMode, serpApiFlights } from "@/lib/providers";
import { PROVIDER_MESSAGES, PROVIDER_STATUS, ProviderError } from "@/lib/providers/errors";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Booking lookups for a live offer, at the moment the user asks to book:
 *  - step "returns": the return flights for a round-trip outbound (departure token)
 *  - step "options": who sells that exact itinerary, with the redirect to their booking page
 * Pyrius never books or takes payment; the user completes the purchase with the seller.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { step?: string; token?: string; params?: unknown } | null;
  const params = cleanFlightParams(body?.params);
  const token = typeof body?.token === "string" && /^[\w\-=+/.%:]{8,4000}$/.test(body.token) ? body.token : null;
  if (!params || !token || (body?.step !== "returns" && body?.step !== "options")) {
    return NextResponse.json({ error: "This offer can't be booked from here.", code: "bad_request" }, { status: 400 });
  }
  if (flightMode() !== "live") {
    return NextResponse.json({ error: PROVIDER_MESSAGES.not_configured, code: "not_configured" }, { status: 503 });
  }
  const g = await gate(req, "booking");
  if (g instanceof NextResponse) return g;
  try {
    if (body!.step === "returns") {
      const offers = await serpApiFlights.returns(token, params);
      if (!offers.length) return NextResponse.json({ error: PROVIDER_MESSAGES.expired, code: "expired" }, { status: 410 });
      // Google sometimes lists the same flights more than once (different fare bundles); keep the cheapest of each.
      const seen = new Set<string>();
      const unique = offers
        .sort((a, b) => a.totalPrice - b.totalPrice)
        .filter((o) => {
          const k = `${o.outbound.flightNumber}|${o.outbound.depart}`;
          return !seen.has(k) && Boolean(seen.add(k));
        });
      return NextResponse.json({ offers: unique.slice(0, 20), fetchedAt: new Date().toISOString() });
    }
    const options = await serpApiFlights.bookingOptions(token, params);
    if (!options.length) return NextResponse.json({ error: "No seller currently offers this itinerary online. Search again for current options.", code: "expired" }, { status: 410 });
    return NextResponse.json({ options, fetchedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof ProviderError) return NextResponse.json({ error: PROVIDER_MESSAGES[err.code], code: err.code }, { status: PROVIDER_STATUS[err.code] });
    console.error("Booking lookup failed:", (err as Error).message);
    return NextResponse.json({ error: PROVIDER_MESSAGES.unavailable, code: "unavailable" }, { status: 502 });
  }
}
