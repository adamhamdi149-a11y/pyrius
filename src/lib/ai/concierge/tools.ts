import { airportLabel, findAirport, isAirportCode, nearbyAirports, placeName as cityName } from "@/lib/data/world";
import { flightBrief, type FlightBrief } from "@/lib/flights/brief";
import { hotelBrief, sortStays, type HotelBrief } from "@/lib/hotels/brief";
import { planById } from "@/lib/plans";
import { getProviders } from "@/lib/providers";
import { PROVIDER_MESSAGES, ProviderError } from "@/lib/providers/errors";
import { searchFlights } from "@/lib/providers/flightSearch";
import { searchHotels } from "@/lib/providers/hotelSearch";
import { suggestedTarget } from "@/lib/tracking/trackers";
import type {
  Attachment,
  BusinessCategory,
  ClientAction,
  DataSource,
  FlightOffer,
  FlightSearchParams,
  HotelSearchParams,
  OfferKind,
  PlanId,
  TripPreferences,
} from "@/lib/types";
import { addDays, daysBetween, parseDate } from "@/lib/utils";

/**
 * The only things the AI can do. Each tool has a strict JSON schema, its arguments are
 * validated again here, and it runs real application code (the provider searches) or
 * returns a validated change for the client to apply through its own store.
 * The model never touches the database, secrets, or anything outside this list.
 */

export interface SavedSummary {
  id: string;
  kind: OfferKind;
  label: string;
  price: number;
  currency: string;
  tracked: boolean;
  target?: number;
}

export interface TurnState {
  trip: TripPreferences;
  today: string;
  locale: "en" | "fr";
  /** The flight results the user is looking at (from the app), replaced by any search in this turn. */
  flights?: { params: FlightSearchParams; source: DataSource; fetchedAt?: string; shown: FlightBrief[] };
  /** The stay cards the user is looking at, replaced by any hotel search in this turn. */
  hotels?: { params: HotelSearchParams; shown: HotelBrief[] };
  saved: SavedSummary[];
  plan: PlanId;
  counts: { saved: number; trackers: number };
  attachments: Attachment[];
  actions: ClientAction[];
  searched?: "flights" | "hotels";
  toolCalls: number;
}

const nullable = (schema: Record<string, unknown>) => ({ ...schema, type: [schema.type as string, "null"] });
const nEnum = (values: string[]) => ({ type: ["string", "null"], enum: [...values, null] });

export const TOOLS = [
  {
    type: "function",
    name: "update_trip",
    strict: true,
    description:
      "Record trip details the user has stated or changed. Pass null for anything not mentioned in this turn; existing details are kept. Call it whenever the user gives or changes a detail, including short answers like a city or a date. Never fill in values the user did not give.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        origin_code: { type: ["string", "null"], pattern: "^[A-Z]{3}$", description: "IATA code of the departure airport; any airport worldwide (YUL, TUN, NBO…)." },
        destination_code: { type: ["string", "null"], pattern: "^[A-Z]{3}$", description: "IATA code of the destination airport; any airport worldwide (FCO, DJE, DSS…)." },
        depart_date: nullable({ type: "string", description: "Departure date, YYYY-MM-DD." }),
        return_date: nullable({ type: "string", description: "Return date, YYYY-MM-DD." }),
        trip_length_days: nullable({ type: "integer", description: "Trip length in days when the user gave a length instead of a return date." }),
        trip_type: { ...nEnum(["round_trip", "one_way"]), description: "Only when the user says so. one_way removes the return date by itself; keep the departure date." },
        flexible_dates: nullable({ type: "boolean" }),
        adults: nullable({ type: "integer" }),
        children: nullable({ type: "integer" }),
        cabin: nEnum(["economy", "premium_economy", "business", "first"]),
        budget_amount: nullable({ type: "number", description: "Flight budget the user stated. 0 means no budget." }),
        budget_basis: { ...nEnum(["total", "per_person"]), description: "Whether the budget is for everyone or per traveler." },
        nonstop_only: nullable({ type: "boolean" }),
        carry_on_only: nullable({ type: "boolean" }),
        departure_time: nEnum(["morning", "afternoon", "evening", "any"]),
        priority: nEnum(["cheapest", "fastest", "balanced"]),
        rooms: nullable({ type: "integer" }),
        stay_type: nEnum(["hotel", "apartment"]),
        stay_budget_per_night: nullable({ type: "number", description: "0 means no nightly budget." }),
        notes: nullable({ type: "string", description: "Other travel preferences in a few words." }),
        clear: {
          type: "array",
          description: "Details the user explicitly wants removed. Usually empty. Don't use it to switch to one-way (use trip_type) or to change a value (just pass the new value).",
          items: { type: "string", enum: ["origin", "destination", "depart_date", "return_date", "all_dates", "budget", "stay_budget", "notes", "preferences"] },
        },
      },
      required: [
        "origin_code", "destination_code", "depart_date", "return_date", "trip_length_days", "trip_type", "flexible_dates", "adults", "children",
        "cabin", "budget_amount", "budget_basis", "nonstop_only", "carry_on_only", "departure_time", "priority", "rooms", "stay_type",
        "stay_budget_per_night", "notes", "clear",
      ],
    },
  },
  {
    type: "function",
    name: "search_flights",
    strict: true,
    description:
      "Search real flight offers for the current trip with Pyrius's flight data provider and show them to the user as cards. Use it whenever the user wants flights or tickets and the required details are known: origin, destination, departure date, return date (round trips) and number of travelers. Use the arguments to refine: sort, nonstop only, carry-on only. The result says whether offers are live and when they were retrieved, or why the search failed.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        sort: nEnum(["price", "duration", "depart"]),
        nonstop_only: nullable({ type: "boolean" }),
        carry_on_only: nullable({ type: "boolean" }),
      },
      required: ["sort", "nonstop_only", "carry_on_only"],
    },
  },
  {
    type: "function",
    name: "get_offer_details",
    strict: true,
    description: "Get full details of up to 3 offers from the latest results, to explain an itinerary or compare options.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["flight", "hotel", "car"] },
        offer_ids: { type: "array", items: { type: "string" } },
      },
      required: ["kind", "offer_ids"],
    },
  },
  {
    type: "function",
    name: "save_offer",
    strict: true,
    description: "Save an offer from the latest results to the user's saved offers. Only when the user asks to save it.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { kind: { type: "string", enum: ["flight", "hotel", "car"] }, offer_id: { type: "string" } },
      required: ["kind", "offer_id"],
    },
  },
  {
    type: "function",
    name: "track_price",
    strict: true,
    description:
      "Start or update price tracking for an offer from the latest results or the user's saved offers. Only when the user asks. target_price null uses a suggested target slightly below the current price.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { kind: { type: "string", enum: ["flight", "hotel", "car"] }, offer_id: { type: "string" }, target_price: nullable({ type: "number" }) },
      required: ["kind", "offer_id", "target_price"],
    },
  },
  {
    type: "function",
    name: "list_saved_offers",
    strict: true,
    description: "List the user's saved offers and which ones have price tracking.",
    parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
  {
    type: "function",
    name: "search_hotels",
    strict: true,
    description:
      "Search live hotels (or vacation rentals with stay_type apartment) at the destination for the trip dates with Google Hotels, and show them as cards with real prices, ratings and photos. Needs destination, check-in and check-out dates (the trip's dates by default).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        stay_type: nEnum(["hotel", "apartment"]),
        rooms: nullable({ type: "integer" }),
        max_per_night: nullable({ type: "number" }),
        sort: { ...nEnum(["price", "luxury"]), description: "luxury when the user wants the best, has a large or unlimited budget, or asks for luxury or 5 stars; otherwise price." },
      },
      required: ["stay_type", "rooms", "max_per_night", "sort"],
    },
  },
  {
    type: "function",
    name: "find_local_services",
    strict: true,
    description:
      "Find real local businesses on Google Maps and show them as cards with their rating, phone, website and distance: car rental agencies, car dealerships, private jet charter operators or yacht charters. Use it for rental cars, buying a car, private jets and yachts. airport_code is the IATA code of the place to search near; null uses the trip's destination (for private jets, the departure city).",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        category: { type: "string", enum: ["rental_agency", "dealership", "private_jet", "yacht"] },
        airport_code: { type: ["string", "null"], pattern: "^[A-Z]{3}$", description: "IATA code of the airport for the place to search near, or null." },
      },
      required: ["category", "airport_code"],
    },
  },
] as const;

export type ToolName = (typeof TOOLS)[number]["name"];

/* ---------------- Validation helpers ---------------- */

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const int = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined);
const num = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : undefined);
const travelers = (t: TripPreferences) => (t.adults ?? 0) + (t.children ?? 0);
const MAX_AHEAD_DAYS = 330;

function realDate(s: string) {
  // Rejects things like 2026-02-31 that Date would silently roll over.
  const d = parseDate(s);
  const back = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return back === s;
}

export function missingForFlights(t: TripPreferences): string[] {
  const m: string[] = [];
  if (!t.originCode) m.push("departure city");
  if (!t.destinationCode) m.push("destination");
  if (!t.departDate) m.push("departure date");
  if (t.tripType !== "oneway" && !t.returnDate) m.push("return date or trip length (or say it's one-way)");
  if (!t.adults) m.push("number of travelers");
  return m;
}

export function describeTrip(t: TripPreferences) {
  return {
    origin: t.originCode ? airportLabel(t.originCode) : null,
    destination: t.destinationCode ? airportLabel(t.destinationCode) : null,
    trip_type: t.tripType === "oneway" ? "one-way" : t.returnDate ? "round trip" : null,
    depart_date: t.departDate ?? null,
    return_date: t.returnDate ?? null,
    trip_length_days: t.departDate && t.returnDate ? daysBetween(t.departDate, t.returnDate) : (t.durationDays ?? null),
    flexible_dates: t.flexibleDates ?? null,
    adults: t.adults ?? null,
    children: t.children ?? null,
    cabin: t.cabin ?? null,
    flight_budget_total: t.budget ? `${t.budget} ${t.currency}` : t.budget === 0 ? "no budget" : null,
    budget_per_person: t.budgetPerPerson ?? null,
    nonstop_only: t.nonstopOnly ?? null,
    carry_on_only: t.carryOnOnly ?? null,
    departure_time: t.departureTime ?? null,
    priority: t.priority ?? null,
    rooms: t.rooms ?? null,
    stay_type: t.stayType ?? null,
    stay_budget_per_night: t.stayBudgetPerNight || null,
    notes: t.notes ?? null,
    currency: t.currency,
    still_needed_for_flight_search: missingForFlights(t),
  };
}

/* ---------------- update_trip ---------------- */

type TripArgs = Record<string, unknown> & { clear?: string[] };

export function applyTripUpdate(prev: TripPreferences, a: TripArgs, today: string) {
  const t: TripPreferences = { ...prev };
  const issues: string[] = [];
  const changed: string[] = [];
  const set = <K extends keyof TripPreferences>(k: K, v: TripPreferences[K]) => {
    if (v !== undefined && t[k] !== v) {
      t[k] = v;
      changed.push(k);
    }
  };
  const latest = addDays(today, MAX_AHEAD_DAYS);

  for (const c of a.clear ?? []) {
    if (c === "origin") t.originCode = undefined;
    if (c === "destination") t.destinationCode = undefined;
    if (c === "depart_date") t.departDate = undefined;
    if (c === "all_dates") Object.assign(t, { departDate: undefined, returnDate: undefined, durationDays: undefined });
    if (c === "return_date") Object.assign(t, { returnDate: undefined, durationDays: undefined });
    if (c === "budget") Object.assign(t, { budget: undefined, budgetPerPerson: undefined });
    if (c === "stay_budget") t.stayBudgetPerNight = undefined;
    if (c === "notes") t.notes = undefined;
    if (c === "preferences") Object.assign(t, { nonstopOnly: undefined, carryOnOnly: undefined, departureTime: undefined, priority: undefined, cabin: undefined });
    changed.push(`cleared ${c}`);
  }

  const airport = (v: unknown, what: string) => {
    if (v == null) return undefined;
    const c = String(v).trim().toUpperCase();
    if (isAirportCode(c)) return c;
    issues.push(`"${v}" isn't an airport with scheduled flights. Use the IATA code of the airport that serves the ${what}.`);
    return undefined;
  };
  const origin = airport(a.origin_code, "departure city");
  const destination = airport(a.destination_code, "destination");
  if (origin) set("originCode", origin);
  if (destination) {
    if (destination === t.originCode) issues.push("The destination is the same as the departure city. Ask which one the user meant.");
    else set("destinationCode", destination);
  }

  if (a.trip_type === "one_way") {
    set("tripType", "oneway");
    t.returnDate = undefined;
    t.durationDays = undefined;
  } else if (a.trip_type === "round_trip") set("tripType", "round");

  const prevLength = prev.departDate && prev.returnDate ? daysBetween(prev.departDate, prev.returnDate) : prev.durationDays;
  if (a.depart_date != null) {
    if (!isDate(a.depart_date) || !realDate(a.depart_date)) issues.push(`"${a.depart_date}" is not a valid departure date.`);
    else if (a.depart_date < today) issues.push(`The departure date ${a.depart_date} is in the past (today is ${today}). Ask for a future date.`);
    else if (a.depart_date > latest) issues.push(`${a.depart_date} is more than ${MAX_AHEAD_DAYS} days away; airlines usually publish schedules about 11 months ahead.`);
    else {
      set("departDate", a.depart_date);
      // A new departure with no new return keeps the same trip length.
      if (a.return_date == null && a.trip_length_days == null && prev.departDate && prev.returnDate && prevLength && t.tripType !== "oneway") {
        t.returnDate = addDays(a.depart_date, prevLength);
      }
    }
  }
  if (a.return_date != null) {
    if (!isDate(a.return_date) || !realDate(a.return_date)) issues.push(`"${a.return_date}" is not a valid return date.`);
    else if (t.departDate && a.return_date <= t.departDate) issues.push(`The return date ${a.return_date} is not after the departure date ${t.departDate}. Ask the user to clarify.`);
    else if (a.return_date > addDays(today, MAX_AHEAD_DAYS + 60)) issues.push(`The return date ${a.return_date} is too far ahead.`);
    else {
      set("returnDate", a.return_date);
      set("tripType", "round");
      t.durationDays = undefined;
    }
  }
  const len = int(a.trip_length_days, 1, 90);
  if (a.trip_length_days != null && len === undefined) issues.push("Trip length must be between 1 and 90 days.");
  if (len !== undefined) {
    set("durationDays", len);
    if (t.tripType !== "oneway") set("tripType", "round");
    if (t.departDate) t.returnDate = addDays(t.departDate, len);
  } else if (t.departDate && !t.returnDate && t.durationDays && t.tripType !== "oneway") {
    t.returnDate = addDays(t.departDate, t.durationDays);
  }

  if (typeof a.flexible_dates === "boolean") set("flexibleDates", a.flexible_dates);
  const adults = int(a.adults, 1, 9);
  if (a.adults != null && adults === undefined) issues.push("Adults must be between 1 and 9 (Pyrius searches up to 9 travelers).");
  if (adults !== undefined) set("adults", adults);
  const kids = int(a.children, 0, 8);
  if (a.children != null && kids === undefined) issues.push("Children must be between 0 and 8.");
  if (kids !== undefined) set("children", kids);
  if (typeof a.cabin === "string") set("cabin", a.cabin as TripPreferences["cabin"]);

  if (a.budget_amount != null) {
    const amount = num(a.budget_amount, 0, 200000);
    if (amount === undefined) issues.push("The budget must be a positive amount.");
    else if (amount === 0) Object.assign(t, { budget: 0, budgetPerPerson: undefined }), changed.push("budget");
    else if (a.budget_basis === "per_person") Object.assign(t, { budgetPerPerson: amount, budget: amount * Math.max(1, travelers(t)) }), changed.push("budget");
    else Object.assign(t, { budget: amount, budgetPerPerson: undefined }), changed.push("budget");
  }
  // A per-person budget follows the number of travelers.
  if (t.budgetPerPerson && travelers(t)) t.budget = t.budgetPerPerson * travelers(t);

  if (typeof a.nonstop_only === "boolean") set("nonstopOnly", a.nonstop_only);
  if (typeof a.carry_on_only === "boolean") set("carryOnOnly", a.carry_on_only);
  if (typeof a.departure_time === "string") set("departureTime", a.departure_time === "any" ? undefined : (a.departure_time as TripPreferences["departureTime"]));
  if (typeof a.priority === "string") set("priority", a.priority as TripPreferences["priority"]);
  const rooms = int(a.rooms, 1, 9);
  if (rooms !== undefined) set("rooms", rooms);
  if (typeof a.stay_type === "string") set("stayType", a.stay_type as TripPreferences["stayType"]);
  if (a.stay_budget_per_night != null) {
    const v = num(a.stay_budget_per_night, 0, 20000);
    if (v !== undefined) set("stayBudgetPerNight", v || undefined);
  }
  if (typeof a.notes === "string" && a.notes.trim()) set("notes", a.notes.trim().slice(0, 200));

  return { trip: t, changed, issues };
}

/* ---------------- Searches and offers ---------------- */

export function flightParams(t: TripPreferences): FlightSearchParams {
  return {
    originCode: t.originCode!,
    destinationCode: t.destinationCode!,
    departDate: t.departDate!,
    returnDate: t.tripType === "oneway" ? undefined : t.returnDate,
    adults: t.adults ?? 1,
    children: t.children ?? 0,
    currency: t.currency,
  };
}

const totalMin = (o: FlightOffer) => o.outbound.durationMin + (o.inbound?.durationMin ?? 0);
const isNonstop = (o: FlightOffer) => o.outbound.stops === 0 && (!o.inbound || o.inbound.stops === 0);

const shownFlight = (s: TurnState, id: string) => s.flights?.shown.find((f) => f.id === id);
const shownHotel = (s: TurnState, id: string) => s.hotels?.shown.find((h) => h.id === id);

const BUSINESS: Record<string, BusinessCategory> = {
  rental_agency: "Car rental agency",
  dealership: "Car dealership",
  private_jet: "Private jet charter",
  yacht: "Yacht charter",
};

// The cards show the exact retrieval time in the user's own timezone, so the AI just says "just now".
const LIVE_NOTE = (at: string) =>
  `Live offers from Google Flights, retrieved just now (${at}); don't state a clock time, the cards show it. Prices and seats can change until the user books with the seller. Pyrius doesn't sell tickets; each card's Book button picks the seller with the lowest price for that trip and opens their booking page.`;
const DEMO_NOTE = "These are Pyrius demo flights (generated examples), not real offers. Say so clearly; never call them real or live.";
const HOTEL_NOTE =
  "Live stays from Google Hotels for these dates and guests: real properties, Google guest ratings (out of 5) and current lowest prices, taxes and fees included where reported. Prices can change until booked. Pyrius doesn't sell rooms; each card's Book button opens the site with the lowest price for these dates.";

function searchFailure(err: unknown) {
  const code = err instanceof ProviderError ? err.code : "unavailable";
  const guidance: Record<string, string> = {
    not_configured: "Tell the user plainly that live flight search isn't connected in Pyrius yet, so you can't show real fares right now. Do not show, describe or invent any flights or prices. You may offer to look up the airlines that fly the route or their official sites with web search, clearly as information, not offers.",
    auth: "Tell the user the flight search couldn't be completed because of a problem on Pyrius's side, and that they can try again later. Do not invent flights.",
    quota: "Tell the user the flight search is temporarily unavailable (search limit reached) and to try again later. Do not invent flights.",
    timeout: "Tell the user the flight search took too long and offer to try again. Do not invent flights.",
    unavailable: "Tell the user the flight search couldn't be completed and offer to try again. Do not invent flights.",
    bad_request: "Check the trip details with the user; the provider couldn't run this search.",
  };
  return { ok: false, error: code, message: PROVIDER_MESSAGES[code as keyof typeof PROVIDER_MESSAGES] ?? PROVIDER_MESSAGES.unavailable, guidance: guidance[code] ?? guidance.unavailable, flights_found: 0 };
}

/* ---------------- Executor ---------------- */

export async function runTool(name: string, rawArgs: string, s: TurnState): Promise<Record<string, unknown>> {
  s.toolCalls += 1;
  if (s.toolCalls > 10) return { ok: false, error: "Too many actions in one turn. Answer the user with what you have." };
  let a: Record<string, unknown>;
  try {
    a = JSON.parse(rawArgs || "{}");
  } catch {
    return { ok: false, error: "Arguments were not valid JSON." };
  }
  const p = getProviders();

  switch (name as ToolName) {
    case "update_trip": {
      const r = applyTripUpdate(s.trip, a as TripArgs, s.today);
      s.trip = r.trip;
      return { ok: r.issues.length === 0, changed: r.changed, issues: r.issues, trip: describeTrip(s.trip) };
    }

    case "search_flights": {
      const missing = missingForFlights(s.trip);
      if (missing.length) return { ok: false, error: "missing_details", missing, hint: "Ask the user for the missing details (one short question)." };
      const wantNonstop = (a.nonstop_only as boolean | null) ?? s.trip.nonstopOnly ?? false;
      const carryOn = (a.carry_on_only as boolean | null) ?? s.trip.carryOnOnly ?? false;
      const sort = (a.sort as "price" | "duration" | "depart" | null) ?? (s.trip.priority === "fastest" ? "duration" : "price");
      const params = flightParams(s.trip);
      let snap;
      try {
        snap = await searchFlights(params);
      } catch (err) {
        s.searched = "flights";
        return searchFailure(err);
      }
      const offers = snap.offers;
      if (!offers.length) {
        const near = (c: string) => nearbyAirports(c).map((a) => `${a.city} ${a.code} (${a.km} km)`);
        return {
          ok: true,
          flights_found: 0,
          data_source: snap.source,
          guidance:
            "Google Flights returned no itineraries for this route and these dates; smaller airports are often only reachable with a separate connection. Say so, and offer to search to one of the nearby destination airports listed (name two or three), or other dates. Mention a nearby departure airport only if the user asks for more options. Don't invent alternatives.",
          nearby_destination_airports: near(params.destinationCode),
          nearby_origin_airports: near(params.originCode),
        };
      }
      const nonstopCount = offers.filter(isNonstop).length;
      const nonstopApplied = wantNonstop && nonstopCount > 0;
      const knownBags = offers.some((o) => o.baggage);
      const carryOnApplied = carryOn && knownBags;
      let view = offers.filter((o) => (!nonstopApplied || isNonstop(o)) && (!carryOnApplied || o.baggage?.carryOn));
      view = [...view].sort((x, y) => (sort === "duration" ? totalMin(x) - totalMin(y) : sort === "depart" ? x.outbound.depart.localeCompare(y.outbound.depart) : x.totalPrice - y.totalPrice));
      const budget = s.trip.budget || undefined;
      const cheapest = [...offers].sort((x, y) => x.totalPrice - y.totalPrice)[0];
      const fastest = [...offers].sort((x, y) => totalMin(x) - totalMin(y))[0];
      s.flights = { params, source: snap.source, fetchedAt: snap.fetchedAt, shown: view.map((o, i) => flightBrief(o, i + 1)) };
      s.searched = "flights";
      s.attachments = s.attachments.filter((x) => x.type !== "flights");
      s.attachments.push({ type: "flights", params, budget, filters: { nonstopOnly: nonstopApplied, carryOnOnly: carryOnApplied, sort }, snapshot: snap });
      const round = Boolean(params.returnDate);
      return {
        ok: true,
        flights_found: offers.length,
        live: snap.source === "live",
        data_source: snap.source === "live" ? LIVE_NOTE(snap.fetchedAt) : DEMO_NOTE,
        shown_to_user: "The offers are displayed as interactive cards under your reply. Don't list every flight; highlight two or three.",
        route: `${cityName(params.originCode)} → ${cityName(params.destinationCode)}`,
        dates: round ? `${params.departDate} to ${params.returnDate}` : `${params.departDate}, one-way`,
        travelers: `${params.adults} adult(s)${params.children ? `, ${params.children} child(ren)` : ""}`,
        pricing: round
          ? snap.source === "live" && offers.some((o) => o.returnPending)
            ? "Prices are round-trip totals for all travelers, with the cheapest return flight for each outbound flight. Book adds that return and opens the cheapest seller's page."
            : "Prices are round-trip totals for all travelers."
          : "Prices are one-way totals for all travelers.",
        shown_after_filters: view.length,
        nonstop_offers: nonstopCount,
        nonstop_note: wantNonstop && !nonstopCount ? "No nonstop flights were returned, so connections are shown." : null,
        baggage_note: knownBags ? null : "This provider doesn't report included bags per offer; the seller shows baggage rules when booking.",
        within_budget: budget ? offers.filter((o) => o.totalPrice <= budget).length : null,
        budget_total: budget ?? null,
        cabin_note:
          snap.source === "demo" && (s.trip.cabin === "business" || s.trip.cabin === "first") ? `Demo results only include economy and premium economy, not ${s.trip.cabin}.` : null,
        cheapest_id: cheapest.id,
        fastest_id: fastest.id,
        top: view.slice(0, 5).map((o, i) => flightBrief(o, i + 1)),
      };
    }

    case "get_offer_details": {
      const kind = a.kind as OfferKind;
      const ids = Array.isArray(a.offer_ids) ? (a.offer_ids as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 3) : [];
      if (kind === "flight") {
        const found = ids.map((id) => shownFlight(s, id)).filter(Boolean);
        if (!found.length) return { ok: false, error: "Those flights aren't in the results the user is looking at. Ask which one they mean, or search again." };
        return { ok: true, data_source: s.flights?.source === "live" ? LIVE_NOTE(s.flights.fetchedAt ?? new Date().toISOString()) : DEMO_NOTE, offers: found };
      }
      if (kind === "hotel") {
        const found = ids.map((id) => shownHotel(s, id)).filter(Boolean);
        if (!found.length) return { ok: false, error: "Those stays aren't in the results the user is looking at. Ask which one they mean, or search again." };
        return { ok: true, data_source: HOTEL_NOTE, offers: found };
      }
      return { ok: false, error: "Pyrius doesn't show rental car offers with prices; use find_local_services for rental agencies." };
    }

    case "save_offer": {
      const kind = a.kind as OfferKind;
      const id = String(a.offer_id ?? "");
      if (s.saved.some((x) => x.id === id)) return { ok: true, status: "already_saved" };
      const flight = kind === "flight" ? shownFlight(s, id) : undefined;
      const hotel = kind === "hotel" ? shownHotel(s, id) : undefined;
      if (!flight && !hotel) return { ok: false, error: "That offer isn't in the results the user is looking at, so it can't be saved. Ask which one they mean." };
      const limit = planById(s.plan).limits.saved;
      if (s.counts.saved >= limit) return { ok: false, error: "plan_limit", detail: `The ${planById(s.plan).name} plan holds ${limit} saved offers. They can remove some or upgrade in Settings.` };
      s.actions = s.actions.filter((x) => !(x.type === "save" && x.offerId === id));
      s.actions.push({ type: "save", offerId: id, kind });
      s.counts.saved += 1;
      return { ok: true, status: "saved", label: flight ? `${flight.airline} ${flight.out.slice(0, 40)}` : hotel!.name };
    }

    case "track_price": {
      const kind = a.kind as OfferKind;
      const id = String(a.offer_id ?? "");
      const flight = kind === "flight" ? shownFlight(s, id) : undefined;
      const hotel = kind === "hotel" ? shownHotel(s, id) : undefined;
      const saved = s.saved.find((x) => x.id === id);
      if (!flight && !hotel && !saved) return { ok: false, error: "That offer isn't in the results or saved offers. Ask which one they mean." };
      const price = flight?.price ?? hotel?.total ?? saved!.price;
      const requested = num(a.target_price, 1, 1_000_000);
      if (a.target_price != null && requested === undefined) return { ok: false, error: "The target price must be a positive amount." };
      const target = requested ?? suggestedTarget(price);
      const already = saved?.tracked;
      const limit = planById(s.plan).limits.trackers;
      if (!already && s.counts.trackers >= limit) return { ok: false, error: "plan_limit", detail: `The ${planById(s.plan).name} plan tracks up to ${limit} prices. They can stop one or upgrade in Settings.` };
      // Tracking saves the offer too, so a separate save for it is redundant.
      s.actions = s.actions.filter((x) => x.offerId !== id);
      s.actions.push({ type: "track", offerId: id, kind, targetPrice: target });
      if (!already) s.counts.trackers += 1;
      return {
        ok: true,
        status: already ? "target_updated" : "tracking_started",
        current_price: price,
        target_price: target,
        note: `The offer is saved with its target in Price tracking. The user taps Run check there whenever they want today's real price; there are no automatic checks or email alerts. Never predict that the price will drop.`,
      };
    }

    case "list_saved_offers":
      return { ok: true, count: s.saved.length, saved: s.saved.slice(0, 30) };

    case "search_hotels": {
      const t = s.trip;
      const missing = [!t.destinationCode && "destination", !t.departDate && "check-in date", !t.returnDate && "check-out date"].filter(Boolean);
      if (missing.length) return { ok: false, error: "missing_details", missing };
      const stayType = (a.stay_type as "hotel" | "apartment" | null) ?? t.stayType ?? "hotel";
      const rooms = int(a.rooms, 1, 9) ?? t.rooms ?? Math.max(1, Math.ceil((t.adults ?? 1) / 2));
      const params: HotelSearchParams = { destinationCode: t.destinationCode!, checkIn: t.departDate!, checkOut: t.returnDate!, guests: Math.max(1, travelers(t)), rooms, currency: t.currency, stayType };
      const maxNight = num(a.max_per_night, 1, 100000) ?? t.stayBudgetPerNight;
      s.trip = { ...t, rooms, stayType, stayBudgetPerNight: maxNight ?? t.stayBudgetPerNight };
      s.searched = "hotels";
      let snap;
      try {
        snap = await searchHotels(params);
      } catch (err) {
        return { ...searchFailure(err), guidance: "Tell the user the hotel search couldn't be completed and offer to try again. Do not describe or invent any hotels or prices." };
      }
      const offers = snap.offers;
      const luxury = a.sort === "luxury";
      const shown = sortStays(offers, luxury ? "luxury" : "price").map((h, i) => hotelBrief(h, i + 1));
      s.hotels = { params, shown };
      s.attachments = s.attachments.filter((x) => x.type !== "hotels");
      s.attachments.push({ type: "hotels", params, budgetPerNight: maxNight || undefined, sort: luxury ? "luxury" : undefined, snapshot: snap });
      if (!offers.length) {
        return { ok: true, total_offers: 0, guidance: "Google Hotels returned no stays with prices for these dates here. Say so and suggest other dates or a nearby city. Don't invent hotels." };
      }
      return {
        ok: true,
        live: snap.source === "live",
        data_source: snap.source === "live" ? HOTEL_NOTE : "These are Pyrius example stays, not real listings. Say so clearly.",
        shown_to_user: `The stays are displayed as cards under your reply (${luxury ? "highest class and best rated first" : "cheapest first"}). Don't list them all; highlight two or three by name, rating and price.`,
        nights: daysBetween(params.checkIn, params.checkOut),
        guests: params.guests,
        rooms_note: rooms > 1 ? "Google Hotels prices are for the number of guests, not per room; tell the user to check room count on the site when booking." : null,
        total_offers: offers.length,
        within_nightly_budget: maxNight ? offers.filter((h) => h.pricePerNight <= maxNight).length : null,
        top: shown.slice(0, 6),
      };
    }

    case "find_local_services": {
      const category = BUSINESS[String(a.category)];
      if (!category) return { ok: false, error: "Unknown category." };
      const jets = category === "Private jet charter";
      const code = isAirportCode(a.airport_code) ? a.airport_code : jets ? (s.trip.originCode ?? s.trip.destinationCode) : (s.trip.destinationCode ?? s.trip.originCode);
      if (!code) return { ok: false, error: "missing_details", missing: [jets ? "departure city" : "destination"], hint: "Ask where they want to search (one short question)." };
      let result;
      try {
        result = await p.businesses.search(code, category);
      } catch (err) {
        return { ...searchFailure(err), guidance: "Tell the user the search for local companies couldn't be completed and offer to try again. Don't name any businesses." };
      }
      s.attachments = s.attachments.filter((x) => !(x.type === "businesses" && x.category === category));
      s.attachments.push({ type: "businesses", destinationCode: code, category, snapshot: result });
      const where = findAirport(code)?.city ?? code;
      return {
        ok: true,
        data_source:
          result.source === "live"
            ? "Real businesses listed on Google Maps right now, with their Google rating. You may name them. They don't publish prices Pyrius can read: never state or estimate a price for them; say each one quotes on its website or by phone."
            : "No business directory is connected; don't name any business.",
        shown_to_user: `Cards for ${category.toLowerCase()}s near ${where} are shown under your reply, with phone, website and map links. Highlight two or three; don't list them all.`,
        widened: result.widened ? `None were found close to ${where}; the cards show the nearest ones and how far away they are. Say so.` : null,
        found: result.businesses.length,
        top: result.businesses.slice(0, 6).map((b) => ({ name: b.name, type: b.type ?? null, rating: b.rating ?? null, reviews: b.reviews ?? null, km_away: b.distanceKm ?? null, has_website: Boolean(b.website) })),
        deals_hint:
          category === "Private jet charter" || category === "Yacht charter"
            ? "If the user wants deals (for example empty-leg flights or last-minute charters), use web search for currently published offers and cite each source. Present them as published offers to confirm with the operator, never as bookable Pyrius prices."
            : category === "Car dealership"
              ? "Dealerships sell cars; they usually don't rent them. Prices are on each dealer's website."
              : null,
      };
    }

    default:
      return { ok: false, error: `Unknown action "${name}".` };
  }
}
