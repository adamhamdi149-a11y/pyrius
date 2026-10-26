import { NextResponse } from "next/server";
import { allow } from "@/lib/ai/concierge/rateLimit";
import { isAirportCode } from "@/lib/data/world";
import { getUserFromRequest } from "@/lib/supabase/server";
import type { BusinessCategory, FlightSearchParams, HotelSearchParams } from "@/lib/types";

/**
 * Requests that spend paid quota (AI, live flight searches, booking lookups) need a signed-in
 * user in production, and each user is rate-limited per bucket.
 */
export async function gate(req: Request, bucket: string): Promise<{ who: string } | NextResponse> {
  const supabaseOn = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const user = supabaseOn ? await getUserFromRequest(req) : null;
  if (supabaseOn && !user && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Please sign in to use Pyrius.", code: "signed_out" }, { status: 401 });
  }
  const who = user?.id ?? `ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}`;
  const ok = allow(`${bucket}:${who}`);
  if (!ok.ok) {
    return NextResponse.json({ error: "You're going a little fast. Give it a moment and try again.", code: "slow_down" }, { status: 429, headers: { "Retry-After": String(ok.retryAfter) } });
  }
  return { who };
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const intIn = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);

/** Flight search parameters from the browser, checked field by field. */
export function cleanFlightParams(v: unknown): FlightSearchParams | undefined {
  const p = (v && typeof v === "object" ? v : {}) as Partial<FlightSearchParams>;
  if (!isAirportCode(p.originCode) || !isAirportCode(p.destinationCode)) return undefined;
  if (p.originCode === p.destinationCode || !isDate(p.departDate)) return undefined;
  const returnDate = isDate(p.returnDate) && p.returnDate > p.departDate ? p.returnDate : undefined;
  return {
    originCode: p.originCode,
    destinationCode: p.destinationCode,
    departDate: p.departDate,
    returnDate,
    adults: intIn(p.adults, 1, 9) ?? 1,
    children: intIn(p.children, 0, 8) ?? 0,
    currency: p.currency === "USD" || p.currency === "EUR" ? p.currency : "CAD",
    nonstopOnly: p.nonstopOnly === true || undefined,
  };
}

/** Hotel search parameters from the browser, checked field by field. */
export function cleanHotelParams(v: unknown): HotelSearchParams | undefined {
  const p = (v && typeof v === "object" ? v : {}) as Partial<HotelSearchParams>;
  if (!isAirportCode(p.destinationCode) || !isDate(p.checkIn) || !isDate(p.checkOut) || p.checkOut <= p.checkIn) return undefined;
  return {
    destinationCode: p.destinationCode,
    checkIn: p.checkIn,
    checkOut: p.checkOut,
    guests: intIn(p.guests, 1, 17) ?? 1,
    rooms: intIn(p.rooms, 1, 9) ?? 1,
    currency: p.currency === "USD" || p.currency === "EUR" ? p.currency : "CAD",
    stayType: p.stayType === "apartment" ? "apartment" : "hotel",
  };
}

export const BUSINESS_CATEGORIES: BusinessCategory[] = ["Car rental agency", "Car dealership", "Private jet charter", "Yacht charter"];
export const isBusinessCategory = (v: unknown): v is BusinessCategory => BUSINESS_CATEGORIES.includes(v as BusinessCategory);
