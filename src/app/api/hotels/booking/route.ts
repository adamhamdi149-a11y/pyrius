import { NextResponse } from "next/server";
import { cleanHotelParams, gate } from "@/lib/apiGate";
import { flightMode, serpApiHotels } from "@/lib/providers";
import { PROVIDER_MESSAGES, PROVIDER_STATUS, ProviderError } from "@/lib/providers/errors";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Who sells a live hotel offer for its dates, cheapest first, each with Google's redirect to the
 * seller's booking page. Pyrius never books or takes payment; the user books with the seller.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string; params?: unknown } | null;
  const params = cleanHotelParams(body?.params);
  const token = typeof body?.token === "string" && /^[\w\-=+/.%:]{8,2000}$/.test(body.token) ? body.token : null;
  if (!params || !token) return NextResponse.json({ error: "This stay can't be booked from here.", code: "bad_request" }, { status: 400 });
  if (flightMode() !== "live") return NextResponse.json({ error: PROVIDER_MESSAGES.not_configured, code: "not_configured" }, { status: 503 });
  const g = await gate(req, "booking");
  if (g instanceof NextResponse) return g;
  try {
    const sellers = await serpApiHotels.sellers(token, params);
    return NextResponse.json({ sellers, fetchedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof ProviderError) {
      const message = err.code === "expired" ? "No site is selling this stay for these dates any more. Search again for current options." : PROVIDER_MESSAGES[err.code];
      return NextResponse.json({ error: message, code: err.code }, { status: PROVIDER_STATUS[err.code] });
    }
    console.error("Hotel booking lookup failed:", (err as Error).message);
    return NextResponse.json({ error: PROVIDER_MESSAGES.unavailable, code: "unavailable" }, { status: 502 });
  }
}
