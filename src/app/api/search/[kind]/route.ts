import { NextResponse } from "next/server";
import { cleanFlightParams, gate } from "@/lib/apiGate";
import { getProviders } from "@/lib/providers";
import { PROVIDER_MESSAGES, PROVIDER_STATUS, ProviderError } from "@/lib/providers/errors";
import { searchFlights } from "@/lib/providers/flightSearch";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Server-side search endpoint. Flights go through the configured provider (live or explicit
 * demo mode) and report where the results came from and when; a failed live search returns
 * an error, never sample flights.
 */
export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const p = getProviders();
  try {
    switch (kind) {
      case "flights": {
        const params = cleanFlightParams(body);
        if (!params) return NextResponse.json({ error: "These search details aren't valid.", code: "bad_request" }, { status: 400 });
        const g = await gate(req, "search");
        if (g instanceof NextResponse) return g;
        return NextResponse.json(await searchFlights(params));
      }
      case "hotels":
        return NextResponse.json({ source: p.hotels.source, offers: await p.hotels.search(body) });
      case "cars":
        return NextResponse.json({ source: p.cars.source, offers: await p.cars.search(body) });
      case "businesses":
        return NextResponse.json(await p.businesses.search(body.destinationCode, body.category));
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
