import { AIRPORTS, airportByCode, cityName } from "@/lib/data/catalog";
import { planById } from "@/lib/plans";
import { getProviders } from "@/lib/providers";
import { suggestedTarget } from "@/lib/tracking/simulator";
import type {
  AnyOffer,
  Attachment,
  CarOffer,
  CarSearchParams,
  ClientAction,
  FlightOffer,
  FlightSearchParams,
  HotelOffer,
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
  /** Latest result sets shown in this conversation (from the client) and in this turn. */
  results: { flights?: FlightSearchParams; hotels?: HotelSearchParams; cars?: CarSearchParams };
  saved: SavedSummary[];
  plan: PlanId;
  counts: { saved: number; trackers: number };
  attachments: Attachment[];
  actions: ClientAction[];
  searched?: "flights" | "hotels" | "cars";
  toolCalls: number;
}

const CODES = AIRPORTS.map((a) => a.code);
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
        origin_code: { ...nEnum(CODES), description: "Departure airport code from the supported list." },
        destination_code: { ...nEnum(CODES), description: "Destination airport code from the supported list." },
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
      "Search flights for the current trip and show the results to the user as cards. Needs origin, destination, departure date, return date (round trips) and number of travelers. Use the arguments to refine the view: sort, nonstop only, carry-on only.",
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
    description: "Search places to stay at the destination for the trip dates and show them as cards. Needs destination, check-in and check-out dates.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { stay_type: nEnum(["hotel", "apartment"]), rooms: nullable({ type: "integer" }), max_per_night: nullable({ type: "number" }) },
      required: ["stay_type", "rooms", "max_per_night"],
    },
  },
  {
    type: "function",
    name: "search_rental_cars",
    strict: true,
    description: "Search rental cars for pick-up at the destination airport for the trip dates and show them as cards.",
    parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
  {
    type: "function",
    name: "find_local_car_businesses",
    strict: true,
    description:
      "Show a map search for local car rental agencies or car dealerships at the destination. Pyrius has no verified business directory, so never name businesses yourself.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { category: { type: "string", enum: ["rental_agency", "dealership"] } },
      required: ["category"],
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
    origin: t.originCode ? `${cityName(t.originCode)} (${t.originCode})` : null,
    destination: t.destinationCode ? `${cityName(t.destinationCode)} (${t.destinationCode})` : null,
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

  if (typeof a.origin_code === "string" && CODES.includes(a.origin_code)) set("originCode", a.origin_code);
  if (typeof a.destination_code === "string" && CODES.includes(a.destination_code)) {
    if (a.destination_code === t.originCode) issues.push("The destination is the same as the departure city. Ask which one the user meant.");
    else set("destinationCode", a.destination_code);
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

const fmtTime = (iso: string) => iso.slice(11, 16);
const fmtDur = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

function flightSummary(o: FlightOffer, n: number) {
  return {
    n,
    id: o.id,
    airline: o.airline.name,
    out: `${o.outbound.from} ${o.outbound.depart.slice(0, 10)} ${fmtTime(o.outbound.depart)} → ${o.outbound.to} ${fmtTime(o.outbound.arrive)}, ${fmtDur(o.outbound.durationMin)}, ${o.outbound.stops ? `${o.outbound.stops} stop (${o.outbound.stopCodes.join(", ")})` : "nonstop"}`,
    back: o.inbound
      ? `${o.inbound.from} ${o.inbound.depart.slice(0, 10)} ${fmtTime(o.inbound.depart)} → ${o.inbound.to} ${fmtTime(o.inbound.arrive)}, ${fmtDur(o.inbound.durationMin)}, ${o.inbound.stops ? `${o.inbound.stops} stop (${o.inbound.stopCodes.join(", ")})` : "nonstop"}`
      : null,
    total: `${o.totalPrice} ${o.currency}`,
    per_traveler: `${o.pricePerTraveler} ${o.currency}`,
    cabin: o.cabin,
    bags: `${o.baggage.carryOn ? "carry-on included" : "no carry-on"}, ${o.baggage.checked} checked`,
  };
}

const totalMin = (o: FlightOffer) => o.outbound.durationMin + (o.inbound?.durationMin ?? 0);

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

function hotelSummary(h: HotelOffer, n: number) {
  return {
    n,
    id: h.id,
    name: h.name,
    type: h.type,
    area: `${h.neighborhood}, ${h.distanceKm} km from centre`,
    stars: h.stars,
    sample_rating: h.rating ?? null,
    per_night: `${h.pricePerNight} ${h.currency}`,
    total: `${h.totalPrice} ${h.currency} for ${h.nights} nights`,
    free_cancellation: h.freeCancellation,
    breakfast: h.breakfastIncluded,
  };
}

function carSummary(c: CarOffer, n: number) {
  return {
    n,
    id: c.id,
    category: c.category,
    example: c.example,
    supplier: c.supplier,
    seats: c.seats,
    bags: c.bags,
    transmission: c.transmission,
    total: `${c.totalPrice} ${c.currency} for ${c.days} days`,
  };
}

/** Finds an offer the user has actually been shown, by re-running the (deterministic) search that produced it. */
async function findOffer(s: TurnState, kind: OfferKind, id: string): Promise<AnyOffer | null> {
  const p = getProviders();
  if (kind === "flight" && s.results.flights) {
    const o = (await p.flights.search(s.results.flights)).find((x) => x.id === id);
    return o ? { kind, offer: o } : null;
  }
  if (kind === "hotel" && s.results.hotels) {
    const o = (await p.hotels.search(s.results.hotels)).find((x) => x.id === id);
    return o ? { kind, offer: o } : null;
  }
  if (kind === "car" && s.results.cars) {
    const o = (await p.cars.search(s.results.cars)).find((x) => x.id === id);
    return o ? { kind, offer: o } : null;
  }
  return null;
}

const offerPrice = (o: AnyOffer) => o.offer.totalPrice;
const offerLabel = (o: AnyOffer) =>
  o.kind === "flight" ? `${o.offer.airline.name} ${o.offer.outbound.from} → ${o.offer.outbound.to}` : o.kind === "hotel" ? o.offer.name : `${o.offer.category} · ${o.offer.supplier}`;

const DEMO_NOTE = "These are Pyrius sample prices (demo data), not live fares or availability. Say so briefly when you mention prices.";

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
      const params = flightParams(s.trip);
      const offers = await p.flights.search(params);
      if (!offers.length) return { ok: false, error: "no_results", hint: "Tell the user no flights were found for these dates and suggest nearby dates." };
      const nonstopCount = offers.filter((o) => o.outbound.stops === 0 && (!o.inbound || o.inbound.stops === 0)).length;
      const wantNonstop = (a.nonstop_only as boolean | null) ?? s.trip.nonstopOnly ?? false;
      const carryOn = (a.carry_on_only as boolean | null) ?? s.trip.carryOnOnly ?? false;
      const sort = (a.sort as "price" | "duration" | "depart" | null) ?? (s.trip.priority === "fastest" ? "duration" : "price");
      const nonstopApplied = wantNonstop && nonstopCount > 0;
      let view = offers.filter((o) => (!nonstopApplied || (o.outbound.stops === 0 && (!o.inbound || o.inbound.stops === 0))) && (!carryOn || o.baggage.carryOn));
      view = [...view].sort((x, y) => (sort === "duration" ? totalMin(x) - totalMin(y) : sort === "depart" ? x.outbound.depart.localeCompare(y.outbound.depart) : x.totalPrice - y.totalPrice));
      const budget = s.trip.budget || undefined;
      const cheapest = [...offers].sort((x, y) => x.totalPrice - y.totalPrice)[0];
      const fastest = [...offers].sort((x, y) => totalMin(x) - totalMin(y))[0];
      s.results.flights = params;
      s.searched = "flights";
      s.attachments = s.attachments.filter((x) => x.type !== "flights");
      s.attachments.push({ type: "flights", params, budget, filters: { nonstopOnly: nonstopApplied, carryOnOnly: carryOn, sort } });
      return {
        ok: true,
        shown_to_user: "The results are displayed as interactive cards under your reply. Don't list every flight; highlight a few.",
        data_source: DEMO_NOTE,
        route: `${cityName(params.originCode)} → ${cityName(params.destinationCode)}`,
        dates: params.returnDate ? `${params.departDate} to ${params.returnDate}` : `${params.departDate}, one-way`,
        travelers: `${params.adults} adult(s)${params.children ? `, ${params.children} child(ren)` : ""}`,
        total_offers: offers.length,
        shown_after_filters: view.length,
        nonstop_offers: nonstopCount,
        nonstop_note: wantNonstop && !nonstopCount ? "No nonstop flights on this route, so connections are shown." : null,
        within_budget: budget ? offers.filter((o) => o.totalPrice <= budget).length : null,
        budget_total: budget ?? null,
        cabin_note: s.trip.cabin === "business" || s.trip.cabin === "first" ? `Pyrius results currently cover economy and premium economy only, not ${s.trip.cabin}.` : null,
        cheapest_id: cheapest.id,
        fastest_id: fastest.id,
        top: view.slice(0, 5).map((o, i) => flightSummary(o, i + 1)),
      };
    }

    case "get_offer_details": {
      const kind = a.kind as OfferKind;
      const ids = Array.isArray(a.offer_ids) ? (a.offer_ids as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 3) : [];
      const found = await Promise.all(ids.map((id) => findOffer(s, kind, id)));
      const offers = found.filter((x): x is AnyOffer => Boolean(x));
      if (!offers.length) return { ok: false, error: "Those offers aren't in the latest results. Search again or ask which option they mean." };
      return {
        ok: true,
        data_source: DEMO_NOTE,
        offers: offers.map((o, i) => (o.kind === "flight" ? flightSummary(o.offer, i + 1) : o.kind === "hotel" ? { ...hotelSummary(o.offer, i + 1), description: o.offer.description, amenities: o.offer.amenities } : { ...carSummary(o.offer, i + 1), conditions: o.offer.conditions })),
      };
    }

    case "save_offer": {
      const kind = a.kind as OfferKind;
      const id = String(a.offer_id ?? "");
      if (s.saved.some((x) => x.id === id)) return { ok: true, status: "already_saved" };
      const o = await findOffer(s, kind, id);
      if (!o) return { ok: false, error: "That offer isn't in the latest results, so it can't be saved. Ask which one they mean." };
      const limit = planById(s.plan).limits.saved;
      if (s.counts.saved >= limit) return { ok: false, error: "plan_limit", detail: `The ${planById(s.plan).name} plan holds ${limit} saved offers. They can remove some or upgrade in Settings.` };
      s.actions = s.actions.filter((x) => !(x.type === "save" && x.offer.offer.id === id));
      s.actions.push({ type: "save", offer: o });
      s.counts.saved += 1;
      return { ok: true, status: "saved", label: offerLabel(o) };
    }

    case "track_price": {
      const kind = a.kind as OfferKind;
      const id = String(a.offer_id ?? "");
      const o = await findOffer(s, kind, id);
      const saved = s.saved.find((x) => x.id === id);
      if (!o && !saved) return { ok: false, error: "That offer isn't in the latest results or saved offers. Ask which one they mean." };
      const price = o ? offerPrice(o) : saved!.price;
      const requested = num(a.target_price, 1, 1_000_000);
      if (a.target_price != null && requested === undefined) return { ok: false, error: "The target price must be a positive amount." };
      const target = requested ?? suggestedTarget(price);
      const already = saved?.tracked;
      const limit = planById(s.plan).limits.trackers;
      if (!already && s.counts.trackers >= limit) return { ok: false, error: "plan_limit", detail: `The ${planById(s.plan).name} plan tracks up to ${limit} prices. They can stop one or upgrade in Settings.` };
      // Tracking saves the offer too, so a separate save for it is redundant.
      s.actions = s.actions.filter((x) => !(x.type === "save" && x.offer.offer.id === id) && !(x.type === "track" && x.offerId === id));
      s.actions.push({ type: "track", offerId: id, offer: o ?? undefined, targetPrice: target });
      if (!already) s.counts.trackers += 1;
      return {
        ok: true,
        status: already ? "target_updated" : "tracking_started",
        label: o ? offerLabel(o) : saved!.label,
        current_price: price,
        target_price: target,
        note: "Price checks in Pyrius are simulated for demo data; say it will alert them in the Price tracking page, not by promising real fare drops.",
      };
    }

    case "list_saved_offers":
      return { ok: true, count: s.saved.length, saved: s.saved.slice(0, 30), data_source: DEMO_NOTE };

    case "search_hotels": {
      const t = s.trip;
      const missing = [!t.destinationCode && "destination", !t.departDate && "check-in date", !t.returnDate && "check-out date"].filter(Boolean);
      if (missing.length) return { ok: false, error: "missing_details", missing };
      const stayType = (a.stay_type as "hotel" | "apartment" | null) ?? t.stayType ?? "hotel";
      const rooms = int(a.rooms, 1, 9) ?? t.rooms ?? Math.max(1, Math.ceil((t.adults ?? 1) / 2));
      const params: HotelSearchParams = { destinationCode: t.destinationCode!, checkIn: t.departDate!, checkOut: t.returnDate!, guests: Math.max(1, travelers(t)), rooms, currency: t.currency, stayType };
      const offers = await p.hotels.search(params);
      const maxNight = num(a.max_per_night, 1, 20000) ?? t.stayBudgetPerNight;
      s.trip = { ...t, rooms, stayType, stayBudgetPerNight: maxNight ?? t.stayBudgetPerNight };
      s.results.hotels = params;
      s.searched = "hotels";
      s.attachments = s.attachments.filter((x) => x.type !== "hotels");
      s.attachments.push({ type: "hotels", params, budgetPerNight: maxNight || undefined });
      const sorted = [...offers].sort((x, y) => x.pricePerNight - y.pricePerNight);
      return {
        ok: true,
        shown_to_user: "The stays are displayed as cards under your reply. Highlight two or three.",
        data_source: "Property names, ratings and prices are illustrative demo data, not real listings or availability. Say so briefly.",
        nights: daysBetween(params.checkIn, params.checkOut),
        rooms,
        total_offers: offers.length,
        within_nightly_budget: maxNight ? offers.filter((h) => h.pricePerNight <= maxNight).length : null,
        top: sorted.slice(0, 5).map((h, i) => hotelSummary(h, i + 1)),
      };
    }

    case "search_rental_cars": {
      const t = s.trip;
      const missing = [!t.destinationCode && "destination", !t.departDate && "pick-up date", !t.returnDate && "drop-off date"].filter(Boolean);
      if (missing.length) return { ok: false, error: "missing_details", missing };
      const params: CarSearchParams = { destinationCode: t.destinationCode!, pickUp: t.departDate!, dropOff: t.returnDate!, currency: t.currency };
      const offers = await p.cars.search(params);
      s.results.cars = params;
      s.searched = "cars";
      s.attachments = s.attachments.filter((x) => x.type !== "cars");
      s.attachments.push({ type: "cars", params });
      return {
        ok: true,
        shown_to_user: "The cars are displayed as cards under your reply.",
        data_source: "Demo prices; the rental company confirms the final price and availability when the user books with them.",
        pick_up: `${cityName(params.destinationCode)} airport, ${params.pickUp} to ${params.dropOff}`,
        total_offers: offers.length,
        top: [...offers].sort((x, y) => x.totalPrice - y.totalPrice).slice(0, 5).map((c, i) => carSummary(c, i + 1)),
      };
    }

    case "find_local_car_businesses": {
      if (!s.trip.destinationCode) return { ok: false, error: "missing_details", missing: ["destination"] };
      const category = a.category === "dealership" ? "Car dealership" : "Car rental agency";
      s.attachments.push({ type: "businesses", destinationCode: s.trip.destinationCode, category });
      return {
        ok: true,
        shown_to_user: `A map search for ${category.toLowerCase()} near ${airportByCode(s.trip.destinationCode)?.city} is shown under your reply.`,
        note: "Pyrius has no verified business directory. Do not name businesses, phone numbers or addresses. Dealerships sell cars; they usually don't rent them.",
      };
    }

    default:
      return { ok: false, error: `Unknown action "${name}".` };
  }
}
