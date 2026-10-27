import { NextResponse } from "next/server";
import { cleanFlightParams, cleanHotelParams, gate, isBusinessCategory } from "@/lib/apiGate";
import { isAirportCode } from "@/lib/data/world";
import { getProviders } from "@/lib/providers";
import { PROVIDER_MESSAGES, PROVIDER_STATUS, ProviderError } from "@/lib/providers/errors";
import { searchFlights } from "@/lib/providers/flightSearch";
import { searchHotels } from "@/lib/providers/hotelSearch";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Server-side search endpoint. Flights, stays and local businesses go through the configured
 * provider (live, or explicit demo mode in development) and report where the results came from
 * and when; a failed live search returns an error, never sample results.
 */
export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const invalid = () => NextResponse.json({ error: "These search details aren't valid.", code: "bad_request" }, { status: 400 });
  try {
    switch (kind) {
      case "flights": {
        const params = cleanFlightParams(body);
        if (!params) return invalid();
        const g = await gate(req, "search");
        if (g instanceof NextResponse) return g;
        return NextResponse.json(await searchFlights(params));
      }
      case "hotels": {
        const params = cleanHotelParams(body);
        if (!params) return invalid();
        const g = await gate(req, "search");
        if (g instanceof NextResponse) return g;
        return NextResponse.json(await searchHotels(params));
      }
      case "businesses": {
        const { destinationCode, category } = body as { destinationCode?: unknown; category?: unknown };
        if (!isAirportCode(destinationCode) || !isBusinessCategory(category)) return invalid();
        const g = await gate(req, "search");
        if (g instanceof NextResponse) return g;
        return NextResponse.json(await getProviders().businesses.search(destinationCode, category));
      }
      default:
        return NextResponse.json({ error: "Unknown search type" }, { status: 404 });
    }
  } catch (err) {
    if (err instanceof ProviderError) {
      return NextResponse.json({ error: PROVIDER_MESSAGES[err.code], code: err.code }, { status: PROVIDER_STATUS[err.code] });
    }
    console.error(`Search ${kind} failed:`, (err as Error).message);
    return NextResponse.json({ error: "The travel provider didn't respond. Please try again.", code: "unavailable" }, { status: 502 });
  }
}
