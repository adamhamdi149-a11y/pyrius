import { NextResponse } from "next/server";
import { cleanFlightParams, cleanHotelParams, gate } from "@/lib/apiGate";
import { flightMode } from "@/lib/providers";
import { PROVIDER_MESSAGES, PROVIDER_STATUS, ProviderError } from "@/lib/providers/errors";
import { recheckFlight, recheckStay } from "@/lib/tracking/recheck";
import type { FlightSegment } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const str = (v: unknown, max = 120) => (typeof v === "string" && v.length <= max ? v : null);
const segment = (v: unknown): Pick<FlightSegment, "flightNumber" | "depart"> | null => {
  const s = v as Partial<FlightSegment> | undefined;
  const flightNumber = str(s?.flightNumber);
  const depart = str(s?.depart, 20);
  return flightNumber !== null && depart && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(depart) ? { flightNumber, depart } : null;
};

/**
 * "Check now" for one tracked offer: looks it up again with its live provider and returns today's
 * price, or that it's no longer sold. The app records the result on its tracker.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { kind?: string; offer?: Record<string, unknown> } | null;
  const o = body?.offer;
  if (flightMode() !== "live") return NextResponse.json({ error: PROVIDER_MESSAGES.not_configured, code: "not_configured" }, { status: 503 });
  const bad = () => NextResponse.json({ error: "This offer can't be checked.", code: "bad_request" }, { status: 400 });
  if (!o || typeof o !== "object") return bad();

  let run: () => Promise<unknown>;
  if (body!.kind === "flight") {
    const params = cleanFlightParams((o.booking as { params?: unknown } | undefined)?.params);
    const outbound = segment(o.outbound);
    const inbound = o.inbound === undefined ? undefined : segment(o.inbound);
    if (!params || !outbound || inbound === null) return bad();
    run = () => recheckFlight({ outbound: outbound as FlightSegment, inbound: inbound as FlightSegment | undefined, booking: { params } });
  } else if (body!.kind === "hotel") {
    const params = cleanHotelParams(o.params);
    const token = str(o.propertyToken, 2000);
    if (!params || !token || !/^[\w\-=+/.%:]{8,}$/.test(token)) return bad();
    run = () => recheckStay({ propertyToken: token, params });
  } else return bad();

  const g = await gate(req, "search");
  if (g instanceof NextResponse) return g;
  try {
    return NextResponse.json(await run());
  } catch (err) {
    if (err instanceof ProviderError) return NextResponse.json({ error: PROVIDER_MESSAGES[err.code], code: err.code }, { status: PROVIDER_STATUS[err.code] });
    console.error("Price check failed:", (err as Error).message);
    return NextResponse.json({ error: PROVIDER_MESSAGES.unavailable, code: "unavailable" }, { status: 502 });
  }
}
