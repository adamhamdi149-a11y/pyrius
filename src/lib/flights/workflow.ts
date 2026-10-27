import type { Cabin, FlightSearchParams, TripLeg, TripPreferences } from "@/lib/types";
import { addDays } from "@/lib/utils";

/**
 * The flight-search workflow: the single source of truth for what a trip still needs, what the
 * user is asked next, and when a search can run. Pure and deterministic, so the chat screen, the
 * AI concierge and the tests all agree. The AI may propose values; they are validated here (or in
 * the concierge's update_trip, which follows the same rules) before they're committed.
 */

export type TripKind = "round" | "oneway" | "multi";
export type FlightStep = "destination" | "origin" | "dates" | "legs" | "ready" | "results";
export type MissingField = "destination" | "origin" | "departDate" | "returnDate" | "legs";

/** Airlines publish schedules about 11 months ahead. */
export const MAX_DAYS_AHEAD = 330;
/** Google Flights takes up to 9 passengers in one search. */
export const MAX_PASSENGERS = 9;
export const MAX_LEGS = 5;

export const CABINS: Cabin[] = ["economy", "premium_economy", "business", "first"];
export const CABIN_LABEL: Record<Cabin, string> = { economy: "Economy", premium_economy: "Premium Economy", business: "Business", first: "First" };
export const CABIN_LABEL_FR: Record<Cabin, string> = { economy: "Économique", premium_economy: "Économique Premium", business: "Affaires", first: "Première" };

export const tripKind = (t: TripPreferences): TripKind => t.tripType ?? "round";

export interface Travelers {
  adults: number;
  children: number;
  infants: number;
}

export const travelersOf = (t: TripPreferences): Travelers => ({ adults: t.adults ?? 1, children: t.children ?? 0, infants: t.infants ?? 0 });

/** Aviation and provider rules for who can fly together. Returns why a combination isn't allowed, or null. */
export function travelersProblem({ adults, children, infants }: Travelers): string | null {
  if (![adults, children, infants].every((n) => Number.isInteger(n) && n >= 0)) return "Enter whole numbers of travelers.";
  if (adults < 1) return "At least one adult has to travel.";
  if (infants > adults) return "Each lap infant needs an adult to sit with.";
  if (adults + children + infants > MAX_PASSENGERS) return `Up to ${MAX_PASSENGERS} travelers can be searched together.`;
  return null;
}

/** Whether one more traveler of this kind can be added, and one removed. */
export function travelerBounds(p: Travelers) {
  const room = adultsChildrenInfants(p) < MAX_PASSENGERS;
  return {
    adults: { add: room, remove: p.adults > 1 && p.infants <= p.adults - 1 },
    children: { add: room, remove: p.children > 0 },
    infants: { add: room && p.infants < p.adults, remove: p.infants > 0 },
  };
}
const adultsChildrenInfants = (p: Travelers) => p.adults + p.children + p.infants;

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Why a departure date can't be used, or null. `today` is YYYY-MM-DD in the user's timezone. */
export function departProblem(depart: string, today: string): string | null {
  if (!isDate(depart)) return "That isn't a valid date.";
  if (depart < today) return "That date has already passed.";
  if (depart > addDays(today, MAX_DAYS_AHEAD)) return "Airlines don't sell flights that far ahead yet.";
  return null;
}

/** Why a return date can't be used with this departure, or null. Same-day returns are allowed. */
export function returnProblem(depart: string | undefined, ret: string, today: string): string | null {
  if (!isDate(ret)) return "That isn't a valid date.";
  if (ret < today) return "That date has already passed.";
  if (depart && ret < depart) return "The return can't be before the departure.";
  if (ret > addDays(today, MAX_DAYS_AHEAD + 60)) return "Airlines don't sell flights that far ahead yet.";
  return null;
}

/** What the trip still needs before a search can run, in the order the user is asked. */
export function missingFields(t: TripPreferences): MissingField[] {
  const kind = tripKind(t);
  if (kind === "multi") {
    const legs = t.legs ?? [];
    return legs.length >= 2 && legs.every((l) => l.from && l.to && l.date) ? [] : ["legs"];
  }
  const out: MissingField[] = [];
  if (!t.destinationCode) out.push("destination");
  if (!t.originCode) out.push("origin");
  if (!t.departDate) out.push("departDate");
  if (kind === "round" && !t.returnDate) out.push("returnDate");
  return out;
}

/** Every problem that blocks a search right now (missing fields first, then invalid values). */
export function searchProblems(t: TripPreferences, today: string): string[] {
  const out: string[] = missingFields(t).map((f) => `missing:${f}`);
  if (out.length) return out;
  const tp = travelersProblem(travelersOf(t));
  if (tp) out.push(tp);
  if (tripKind(t) === "multi") {
    const legs = t.legs!;
    legs.forEach((l, i) => {
      if (l.from === l.to) out.push(`Flight ${i + 1} leaves from and lands at the same airport.`);
      const dp = departProblem(l.date!, today);
      if (dp) out.push(`Flight ${i + 1}: ${dp}`);
      if (i && legs[i - 1].date && l.date! < legs[i - 1].date!) out.push(`Flight ${i + 1} is before flight ${i}.`);
    });
    return out;
  }
  if (t.originCode === t.destinationCode) out.push("The departure and destination airports are the same.");
  const dp = departProblem(t.departDate!, today);
  if (dp) out.push(dp);
  if (tripKind(t) === "round") {
    const rp = returnProblem(t.departDate, t.returnDate!, today);
    if (rp) out.push(rp);
  }
  return out;
}

export const canSearch = (t: TripPreferences, today: string) => searchProblems(t, today).length === 0;

/** The searches a trip runs: one for a round trip or one way, one per flight for multi-city. */
export function searchPlan(t: TripPreferences, today: string): FlightSearchParams[] {
  if (!canSearch(t, today)) return [];
  const pax = travelersOf(t);
  const base = { adults: pax.adults, children: pax.children, infants: pax.infants || undefined, cabin: t.cabin && t.cabin !== "economy" ? t.cabin : undefined, currency: t.currency, nonstopOnly: t.nonstopOnly || undefined };
  if (tripKind(t) === "multi") return t.legs!.map((l) => ({ ...base, originCode: l.from!, destinationCode: l.to!, departDate: l.date! }));
  return [{ ...base, originCode: t.originCode!, destinationCode: t.destinationCode!, departDate: t.departDate!, returnDate: tripKind(t) === "round" ? t.returnDate : undefined }];
}

/** Same search (so its results are still valid for the trip). */
export function sameSearch(a: FlightSearchParams, b: FlightSearchParams) {
  return (
    a.originCode === b.originCode &&
    a.destinationCode === b.destinationCode &&
    a.departDate === b.departDate &&
    (a.returnDate ?? "") === (b.returnDate ?? "") &&
    a.adults === b.adults &&
    a.children === b.children &&
    (a.infants ?? 0) === (b.infants ?? 0) &&
    (a.cabin ?? "economy") === (b.cabin ?? "economy") &&
    a.currency === b.currency &&
    Boolean(a.nonstopOnly) === Boolean(b.nonstopOnly)
  );
}

/** Whether results found with `params` still describe this trip. */
export function resultsMatch(t: TripPreferences, params: FlightSearchParams[], today: string) {
  const plan = searchPlan(t, today);
  return plan.length > 0 && plan.length === params.length && plan.every((p, i) => sameSearch(p, params[i]));
}

/** What happens next. `hasResults`: results for exactly this trip are on screen. */
export function nextStep(t: TripPreferences, hasResults: boolean): FlightStep {
  if (tripKind(t) === "multi") return missingFields(t).length ? "legs" : hasResults ? "results" : "ready";
  const missing = missingFields(t);
  if (missing.includes("destination")) return "destination";
  if (missing.includes("origin")) return "origin";
  if (missing.length) return "dates";
  return hasResults ? "results" : "ready";
}

/* ---------------- Committing changes (each keeps every unrelated detail) ---------------- */

type Result = { trip: TripPreferences; error?: string };

export function setDestination(t: TripPreferences, code: string): Result {
  if (code === t.originCode) return { trip: t, error: "That's where you're leaving from. Pick another destination." };
  return { trip: { ...t, destinationCode: code, destinationQuery: undefined } };
}

export function setOrigin(t: TripPreferences, code: string): Result {
  if (code === t.destinationCode) return { trip: t, error: "That's your destination. Pick where you're leaving from." };
  return { trip: { ...t, originCode: code, originQuery: undefined } };
}

export function swapAirports(t: TripPreferences): TripPreferences {
  return { ...t, originCode: t.destinationCode, destinationCode: t.originCode, originQuery: t.destinationQuery, destinationQuery: t.originQuery };
}

export function setTripKind(t: TripPreferences, kind: TripKind): TripPreferences {
  const confirmed = { ...t.confirmed, tripType: true };
  if (kind === "oneway") return { ...t, tripType: "oneway", returnDate: undefined, durationDays: undefined, confirmed };
  if (kind === "round") {
    // Coming back from multi-city keeps its first flight as the route.
    const first = t.tripType === "multi" ? t.legs?.[0] : undefined;
    return { ...t, tripType: "round", originCode: first?.from ?? t.originCode, destinationCode: first?.to ?? t.destinationCode, departDate: first?.date ?? t.departDate, confirmed };
  }
  const legs: TripLeg[] = t.legs?.length ? t.legs : [{ from: t.originCode, to: t.destinationCode, date: t.departDate }, { from: t.destinationCode, to: undefined, date: undefined }];
  return { ...t, tripType: "multi", legs, confirmed };
}

/** Dates from the calendar. A departure after the current return clears the return. */
export function setDates(t: TripPreferences, depart: string, ret: string | undefined, today: string): Result {
  const dp = departProblem(depart, today);
  if (dp) return { trip: t, error: dp };
  if (tripKind(t) !== "round") return { trip: { ...t, departDate: depart, returnDate: undefined, durationDays: undefined, calendarMonth: undefined } };
  let r = ret;
  if (r && returnProblem(depart, r, today)) r = undefined;
  if (!ret && t.returnDate && t.returnDate >= depart) r = t.returnDate;
  return { trip: { ...t, departDate: depart, returnDate: r, durationDays: undefined, calendarMonth: undefined } };
}

export function setTravelers(t: TripPreferences, p: Travelers): Result {
  const problem = travelersProblem(p);
  if (problem) return { trip: t, error: problem };
  return { trip: { ...t, adults: p.adults, children: p.children, infants: p.infants || undefined, confirmed: { ...t.confirmed, travelers: true } } };
}

export function setCabin(t: TripPreferences, cabin: Cabin): TripPreferences {
  return { ...t, cabin, confirmed: { ...t.confirmed, cabin: true } };
}

export function setLegs(t: TripPreferences, legs: TripLeg[]): Result {
  if (legs.length < 2 || legs.length > MAX_LEGS) return { trip: t, error: `A multi-city trip has 2 to ${MAX_LEGS} flights.` };
  return { trip: { ...t, tripType: "multi", legs } };
}

/* ---------------- Telling the AI what comes next ---------------- */

/** The one next action the AI is allowed to ask for, and the control the app shows with its reply. */
export function nextActionSpec(t: TripPreferences, hasResults: boolean): string {
  return `${spec(t, hasResults)} Ask about nothing else: trip type, travelers and cabin have visible defaults the user can change in the app.`;
}

function spec(t: TripPreferences, hasResults: boolean): string {
  switch (nextStep(t, hasResults)) {
    case "destination":
      return t.destinationQuery
        ? `ask_destination: the user named "${t.destinationQuery}", which isn't a single airport. The app shows an airport picker filtered to it; ask which city or airport in one short sentence.`
        : "ask_destination: the app shows an airport picker for the destination. Ask where they're flying to, in one short sentence.";
    case "origin":
      return t.originQuery
        ? `ask_origin: the user named "${t.originQuery}", which isn't a single airport. The app shows an airport picker filtered to it; ask which airport in one short sentence.`
        : "ask_origin: the app shows an airport picker for the departure. Ask where they're flying from, in one short sentence.";
    case "dates":
      return tripKind(t) === "round" && t.departDate
        ? "ask_return_date: the app shows a calendar. Ask only for the return date (or whether it's one way)."
        : "ask_dates: the app shows a calendar with Round trip / One way / Multi-city. Ask when they want to travel, in one short sentence.";
    case "legs":
      return "ask_route: the app shows a multi-city route editor (airports and a date for each flight). Ask for the missing flights' airports or dates.";
    case "ready":
      return "ready_to_search: every required detail is known. The app shows travelers, cabin and a Search flights button. If the user asked to find or search flights, call search_flights now; otherwise say it's ready to search.";
    case "results":
      return "results_shown: flights for this exact trip are on screen. Help compare or refine; refinements change the trip and need a new search.";
  }
}
