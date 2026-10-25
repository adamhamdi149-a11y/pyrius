import { NextResponse } from "next/server";
import { cleanFlightParams, gate } from "@/lib/apiGate";
import { flightMode, serpApiFlights } from "@/lib/providers";
import { PROVIDER_MESSAGES, PROVIDER_STATUS, ProviderError } from "@/lib/providers/errors";
import type { FlightOffer } from "@/lib/types";

export const runtime = "nodejs";
// "trip" makes two Google Flights lookups in a row.
export const maxDuration = 60;

const STEPS = ["trip", "returns", "options"] as const;
type Step = (typeof STEPS)[number];

/** Google sometimes lists the same flights more than once (different fare bundles); keep the cheapest of each. */
function uniqueReturns(offers: FlightOffer[]) {
  const seen = new Set<string>();
  return [...offers]
    .sort((a, b) => a.totalPrice - b.totalPrice)
    .filter((o) => {
      const k = `${o.outbound.flightNumber}|${o.outbound.depart}`;
      return !seen.has(k) && Boolean(seen.add(k));
    })
    .slice(0, 20);
}

/**
 * Booking lookups for a live offer, at the moment the user asks to book:
 *  - step "trip": for a round-trip outbound (departure token), the cheapest return flight, which is the
 *    price the card showed, plus who sells that whole itinerary
 *  - step "returns": the return flights for that outbound, to pick a different one
 *  - step "options": who sells an exact itinerary (booking token), with the redirect to their booking page
 * Pyrius never books or takes payment; the user completes the purchase with the seller.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { step?: string; token?: string; params?: unknown } | null;
  const params = cleanFlightParams(body?.params);
  const token = typeof body?.token === "string" && /^[\w\-=+/.%:]{8,4000}$/.test(body.token) ? body.token : null;
  const step = STEPS.find((s) => s === body?.step) as Step | undefined;
  if (!params || !token || !step) {
    return NextResponse.json({ error: "This offer can't be booked from here.", code: "bad_request" }, { status: 400 });
  }
  if (flightMode() !== "live") {
    return NextResponse.json({ error: PROVIDER_MESSAGES.not_configured, code: "not_configured" }, { status: 503 });
  }
  const g = await gate(req, "booking");
  if (g instanceof NextResponse) return g;
  const fetchedAt = new Date().toISOString();
  const noSeller = () => NextResponse.json({ error: "No seller currently offers this itinerary online. Search again for current options.", code: "expired" }, { status: 410 });
  try {
    if (step === "options") {
      const choices = await serpApiFlights.bookingOptions(token, params);
      return choices.length ? NextResponse.json({ choices, fetchedAt }) : noSeller();
    }
    const returns = uniqueReturns(await serpApiFlights.returns(token, params));
    if (!returns.length) return NextResponse.json({ error: PROVIDER_MESSAGES.expired, code: "expired" }, { status: 410 });
    if (step === "returns") return NextResponse.json({ returns, fetchedAt });
    const back = returns.find((r) => r.booking?.bookingToken);
    if (!back) return noSeller();
    const choices = await serpApiFlights.bookingOptions(back.booking!.bookingToken!, params);
    return choices.length ? NextResponse.json({ returnFlight: back, returns, choices, fetchedAt }) : noSeller();
  } catch (err) {
    if (err instanceof ProviderError) return NextResponse.json({ error: PROVIDER_MESSAGES[err.code], code: err.code }, { status: PROVIDER_STATUS[err.code] });
    console.error("Booking lookup failed:", (err as Error).message);
    return NextResponse.json({ error: PROVIDER_MESSAGES.unavailable, code: "unavailable" }, { status: 502 });
  }
}
