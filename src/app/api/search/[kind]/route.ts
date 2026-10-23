import { NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";

export const runtime = "nodejs";

/**
 * Server-side search endpoint. The UI only talks to this route, so swapping the demo
 * provider for a real API (with secret keys) requires no client changes.
 */
export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const p = getProviders();
  try {
    switch (kind) {
      case "flights":
        return NextResponse.json({ source: p.flights.source, offers: await p.flights.search(body) });
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
    console.error(`Search ${kind} failed:`, err);
    return NextResponse.json({ error: "The travel provider didn't respond. Please try again." }, { status: 502 });
  }
}
