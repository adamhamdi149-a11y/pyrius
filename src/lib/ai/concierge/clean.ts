import { cleanFlightParams } from "@/lib/apiGate";
import { isAirportCode } from "@/lib/data/world";
import type { FlightBrief } from "@/lib/flights/brief";
import type { HotelBrief } from "@/lib/hotels/brief";
import { PLANS } from "@/lib/plans";
import type { AgentStage, HotelSearchParams, Locale, PlanId, TripPreferences } from "@/lib/types";
import { toISODate } from "@/lib/utils";
import type { ConciergeRequest } from "./index";
import type { SavedSummary } from "./tools";

/**
 * Everything the app sends about a conversation (trip, results on screen, saved offers) comes from
 * the client, so the text chat and the voice routes check it field by field here before it reaches
 * the model or a search.
 */

export const STAGES: AgentStage[] = ["collecting", "flights", "offer-hotels", "hotels", "offer-cars", "cars", "done"];
export const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const intIn = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
export const numIn = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
export const oneOf = <T extends string>(v: unknown, list: readonly T[]) => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
export const code = (v: unknown) => (isAirportCode(v) ? v : undefined);

/** The trip comes from the browser, so every field is checked before it reaches the model or a search. */
export function cleanTrip(p: unknown): TripPreferences {
  const t = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
  const out: TripPreferences = {
    currency: oneOf(t.currency, ["CAD", "USD", "EUR"] as const) ?? "CAD",
    originCode: code(t.originCode),
    destinationCode: code(t.destinationCode),
    departDate: isDate(t.departDate) ? t.departDate : undefined,
    returnDate: isDate(t.returnDate) ? t.returnDate : undefined,
    durationDays: intIn(t.durationDays, 1, 90),
    flexibleDates: bool(t.flexibleDates),
    adults: intIn(t.adults, 1, 9),
    children: intIn(t.children, 0, 8),
    budget: numIn(t.budget, 0, 200000),
    budgetPerPerson: numIn(t.budgetPerPerson, 1, 200000),
    nonstopOnly: bool(t.nonstopOnly),
    carryOnOnly: bool(t.carryOnOnly),
    priority: oneOf(t.priority, ["cheapest", "fastest", "balanced"] as const),
    wantsWarm: bool(t.wantsWarm),
    rooms: intIn(t.rooms, 1, 9),
    stayType: oneOf(t.stayType, ["hotel", "apartment"] as const),
    stayBudgetPerNight: numIn(t.stayBudgetPerNight, 0, 20000),
    carMode: oneOf(t.carMode, ["rental", "agencies", "dealerships"] as const),
    infants: intIn(t.infants, 0, 8),
    tripType: oneOf(t.tripType, ["round", "oneway", "multi"] as const),
    legs: Array.isArray(t.legs)
      ? (t.legs as Record<string, unknown>[]).slice(0, 5).map((l) => ({ from: code(l?.from), to: code(l?.to), date: isDate(l?.date) ? (l.date as string) : undefined }))
      : undefined,
    originQuery: typeof t.originQuery === "string" ? t.originQuery.slice(0, 60) : undefined,
    destinationQuery: typeof t.destinationQuery === "string" ? t.destinationQuery.slice(0, 60) : undefined,
    calendarMonth: typeof t.calendarMonth === "string" && /^\d{4}-\d{2}$/.test(t.calendarMonth) ? t.calendarMonth : undefined,
    confirmed: t.confirmed && typeof t.confirmed === "object" ? { tripType: bool((t.confirmed as Record<string, unknown>).tripType), travelers: bool((t.confirmed as Record<string, unknown>).travelers), cabin: bool((t.confirmed as Record<string, unknown>).cabin) } : undefined,
    cabin: oneOf(t.cabin, ["economy", "premium_economy", "business", "first"] as const),
    departureTime: oneOf(t.departureTime, ["morning", "afternoon", "evening"] as const),
    notes: typeof t.notes === "string" ? t.notes.slice(0, 200) : undefined,
    awaiting: oneOf(t.awaiting, ["origin", "destination", "warm-pick", "dates", "duration", "travelers", "budget", "prefs", "stay-details"] as const),
    askedPrefs: bool(t.askedPrefs),
  };
  (Object.keys(out) as (keyof TripPreferences)[]).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

export function cleanFlights(v: unknown): ConciergeRequest["results"]["flights"] {
  const f = v as { params?: unknown; sort?: string; source?: string; fetchedAt?: string; shown?: unknown[] } | undefined;
  const params = cleanFlightParams(f?.params);
  if (!params) return undefined;
  const str = (x: unknown, n = 200) => (typeof x === "string" ? x.slice(0, n) : "");
  // Summaries of the cards on screen: text and numbers only, bounded, never instructions.
  const shown: FlightBrief[] = (Array.isArray(f!.shown) ? f!.shown : []).slice(0, 30).flatMap((raw, i) => {
    const b = raw as Record<string, unknown>;
    if (!b || typeof b.id !== "string" || !/^[\w-]{3,80}$/.test(b.id)) return [];
    return [{
      n: i + 1,
      id: b.id,
      airline: str(b.airline, 80),
      out: str(b.out),
      back: typeof b.back === "string" ? str(b.back) : null,
      price: numIn(b.price, 0, 1_000_000) ?? 0,
      per_traveler: numIn(b.per_traveler, 0, 1_000_000) ?? 0,
      currency: str(b.currency, 3) || "CAD",
      cabin: str(b.cabin, 30),
      bags: typeof b.bags === "string" ? str(b.bags, 80) : null,
      stops: intIn(b.stops, 0, 10) ?? 0,
      duration_min: intIn(b.duration_min, 0, 10000) ?? 0,
      return_chosen_at_booking: b.return_chosen_at_booking === true,
      notes: Array.isArray(b.notes) ? b.notes.filter((x): x is string => typeof x === "string").slice(0, 3).map((x) => x.slice(0, 120)) : [],
      conditions: Array.isArray(b.conditions) ? b.conditions.filter((x): x is string => typeof x === "string").slice(0, 5).map((x) => x.slice(0, 100)) : [],
    }];
  });
  return {
    params,
    sort: oneOf(f!.sort, ["price", "duration", "depart"] as const),
    source: f!.source === "demo" ? "demo" : "live",
    fetchedAt: typeof f!.fetchedAt === "string" && !Number.isNaN(Date.parse(f!.fetchedAt)) ? f!.fetchedAt : undefined,
    shown,
  };
}

export function cleanHotelParams(v: unknown): HotelSearchParams | undefined {
  const h = v as Partial<HotelSearchParams> | undefined;
  if (!h || !code(h.destinationCode) || !isDate(h.checkIn) || !isDate(h.checkOut)) return undefined;
  return {
    destinationCode: h.destinationCode!,
    checkIn: h.checkIn,
    checkOut: h.checkOut,
    guests: intIn(h.guests, 1, 17) ?? 1,
    rooms: intIn(h.rooms, 1, 9) ?? 1,
    currency: oneOf(h.currency, ["CAD", "USD", "EUR"] as const) ?? "CAD",
    stayType: oneOf(h.stayType, ["hotel", "apartment"] as const),
  };
}

/** The stay cards on screen: text and numbers only, bounded, never instructions. */
export function cleanHotels(v: unknown): ConciergeRequest["results"]["hotels"] {
  const h = v as { params?: unknown; shown?: unknown[] } | undefined;
  const params = cleanHotelParams(h?.params);
  if (!params) return undefined;
  const str = (x: unknown, n = 160) => (typeof x === "string" ? x.slice(0, n) : "");
  const shown: HotelBrief[] = (Array.isArray(h!.shown) ? h!.shown : []).slice(0, 24).flatMap((raw, i) => {
    const b = raw as Record<string, unknown>;
    if (!b || typeof b.id !== "string" || !/^[\w-]{3,80}$/.test(b.id)) return [];
    return [{
      n: i + 1,
      id: b.id,
      name: str(b.name, 120),
      type: str(b.type, 30),
      stars: intIn(b.stars, 0, 5) ?? 0,
      rating: numIn(b.rating, 0, 10) ?? null,
      reviews: intIn(b.reviews, 0, 10_000_000) ?? null,
      per_night: numIn(b.per_night, 0, 1_000_000) ?? 0,
      total: numIn(b.total, 0, 10_000_000) ?? 0,
      nights: intIn(b.nights, 1, 400) ?? 1,
      currency: str(b.currency, 3) || "CAD",
      amenities: (Array.isArray(b.amenities) ? b.amenities : []).slice(0, 6).map((a) => str(a, 40)),
      address: typeof b.address === "string" ? str(b.address) : null,
    }];
  });
  return { params, shown };
}

export function cleanResults(v: unknown): ConciergeRequest["results"] {
  const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return { flights: cleanFlights(r.flights), hotels: cleanHotels(r.hotels) };
}

export function cleanHistory(v: unknown): ConciergeRequest["history"] {
  return (Array.isArray(v) ? v : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
}

export function cleanSaved(v: unknown): SavedSummary[] {
  return (Array.isArray(v) ? v : [])
    .filter((s) => s && typeof s.id === "string" && ["flight", "hotel", "car"].includes(s.kind))
    .slice(0, 60)
    .map((s) => ({
      id: s.id.slice(0, 120),
      kind: s.kind,
      label: String(s.label ?? "").slice(0, 120),
      price: numIn(s.price, 0, 1_000_000) ?? 0,
      currency: String(s.currency ?? "CAD").slice(0, 3),
      tracked: Boolean(s.tracked),
      target: numIn(s.target, 0, 1_000_000),
    }));
}

export const cleanLocale = (v: unknown): Locale => (v === "fr" ? "fr" : "en");
export const cleanPlan = (v: unknown): PlanId => oneOf(v, PLANS.map((p) => p.id)) ?? "free";

export function cleanCounts(v: unknown, saved: SavedSummary[]) {
  const c = (v && typeof v === "object" ? v : {}) as { saved?: unknown; trackers?: unknown };
  return { saved: intIn(c.saved, 0, 100000) ?? saved.length, trackers: intIn(c.trackers, 0, 100000) ?? saved.filter((s) => s.tracked).length };
}

/** Today in the user's timezone, if it's within a day of the server's. */
export function cleanToday(v: unknown) {
  const server = toISODate(new Date());
  return isDate(v) && Math.abs(new Date(v).getTime() - new Date(server).getTime()) <= 864e5 ? v : server;
}
