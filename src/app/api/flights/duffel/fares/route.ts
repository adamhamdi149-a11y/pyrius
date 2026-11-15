import { NextResponse } from "next/server";
import { cleanFlightParams, gate } from "@/lib/apiGate";
import { duffelEnabled, duffelFares } from "@/lib/providers/duffel";
import { PROVIDER_MESSAGES, PROVIDER_STATUS, ProviderError } from "@/lib/providers/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const flights = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[A-Z0-9]{2}\s?\d{1,4}$/.test(x)).slice(0, 6) : undefined);

/**
 * Fares Pyrius can sell itself (Duffel) for the trip the user chose to book: the same flights
 * first when Duffel sells them, then the cheapest alternatives on the route.
 */
export async function POST(req: Request) {
  if (!duffelEnabled()) return NextResponse.json({ error: PROVIDER_MESSAGES.not_configured, code: "not_configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { params?: unknown; outbound?: unknown; inbound?: unknown; airline?: unknown } | null;
  const params = cleanFlightParams(body?.params);
  if (!params) return NextResponse.json({ error: "These trip details aren't valid.", code: "bad_request" }, { status: 400 });
  const g = await gate(req, "booking");
  if (g instanceof NextResponse) return g;
  try {
    const airline = typeof body?.airline === "string" && /^[A-Z0-9]{2}$/.test(body.airline) ? body.airline : undefined;
    const { fares, exact } = await duffelFares(params, { outbound: flights(body?.outbound), inbound: flights(body?.inbound), airline });
    return NextResponse.json({ fares, exact, fetchedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof ProviderError) return NextResponse.json({ error: PROVIDER_MESSAGES[err.code], code: err.code }, { status: PROVIDER_STATUS[err.code] });
    console.error("Duffel fares failed:", (err as Error).message);
    return NextResponse.json({ error: PROVIDER_MESSAGES.unavailable, code: "unavailable" }, { status: 502 });
  }
}
