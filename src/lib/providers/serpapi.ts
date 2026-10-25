import { flightSearchUrl } from "@/lib/booking";
import type { FlightOffer, FlightSearchParams, FlightSegment } from "@/lib/types";
import { hash } from "@/lib/utils";
import { ProviderError } from "./errors";
import type { FlightProvider } from "./types";

/**
 * Live flights from Google Flights through SerpApi (https://serpapi.com/google-flights-api).
 * Server-side only: the API key never leaves this module.
 *
 * Google Flights works in steps, and so does this adapter:
 *  - search: one-way results carry a booking_token; round-trip results are outbound flights
 *    carrying a departure_token, priced as the cheapest round trip with that outbound flight.
 *  - returns(departure_token): the return flights for that outbound, each with a booking_token.
 *  - bookingOptions(booking_token): who sells that exact itinerary, with Google's redirect to
 *    the seller's booking page.
 */

const PROVIDER = "Google Flights";
/** Results are a snapshot of what Google showed; after this long we ask the user to refresh. */
export const FRESH_MINUTES = 30;
// Full Google results ("View more flights") can take 10–15 s.
const TIMEOUT_MS = 28_000;

const base = () => process.env.SERPAPI_BASE_URL || "https://serpapi.com";
const key = () => process.env.SERPAPI_API_KEY;

interface SerpAirport {
  name?: string;
  id?: string;
  time?: string; // "2026-11-12 08:35"
}
interface SerpFlight {
  departure_airport?: SerpAirport;
  arrival_airport?: SerpAirport;
  duration?: number;
  airplane?: string;
  airline?: string;
  airline_logo?: string;
  travel_class?: string;
  flight_number?: string;
  extensions?: string[];
  overnight?: boolean;
  often_delayed_by_over_30_min?: boolean;
}
export interface SerpItinerary {
  flights?: SerpFlight[];
  layovers?: { duration?: number; name?: string; id?: string; overnight?: boolean }[];
  total_duration?: number;
  price?: number;
  type?: string;
  airline_logo?: string;
  extensions?: string[];
  departure_token?: string;
  booking_token?: string;
}
interface SerpResponse {
  error?: string;
  best_flights?: SerpItinerary[];
  other_flights?: SerpItinerary[];
  booking_options?: SerpBookingOption[];
  search_metadata?: { status?: string };
}
export interface SerpBookingOption {
  separate_tickets?: boolean;
  together?: SerpBookingChoice;
  departing?: SerpBookingChoice;
  returning?: SerpBookingChoice;
}
interface SerpBookingChoice {
  book_with?: string;
  airline?: boolean;
  airline_logos?: string[];
  marketed_as?: string[];
  price?: number;
  option_title?: string;
  extensions?: string[];
  baggage_prices?: string[];
  booking_request?: { url?: string; post_data?: string };
  booking_phone?: string;
  estimated_phone_service_fee?: number;
}

export interface BookingOption {
  seller: string;
  isAirline: boolean;
  price?: number;
  currency: string;
  fareName?: string;
  details: string[];
  /** A form POST to Google's booking redirect, which forwards to the seller with this itinerary. */
  request?: { url: string; fields: [string, string][] };
  phone?: string;
  /** Separate tickets are booked one leg at a time. */
  leg?: "departing" | "returning";
}

/** One way to buy the itinerary: a single ticket, or separate outbound and return tickets from two sellers. */
export interface BookingChoice {
  tickets: BookingOption[];
  /** Sum of the ticket prices, when every ticket has one. */
  total?: number;
  currency: string;
}

async function call(params: Record<string, string>): Promise<SerpResponse> {
  const k = key();
  if (!k) throw new ProviderError("not_configured", PROVIDER);
  const qs = new URLSearchParams({ engine: "google_flights", hl: "en", gl: "ca", ...params, api_key: k });
  let res: Response;
  try {
    res = await fetch(`${base()}/search.json?${qs}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (err) {
    const name = (err as Error).name;
    throw new ProviderError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "unavailable", PROVIDER);
  }
  const body = (await res.json().catch(() => ({}))) as SerpResponse;
  const msg = (body.error ?? "").toLowerCase();
  if (res.status === 401 || res.status === 403 || msg.includes("invalid api key") || msg.includes("api key")) throw new ProviderError("auth", PROVIDER, body.error);
  if (res.status === 429 || msg.includes("run out of searches") || msg.includes("rate limit") || msg.includes("throughput")) throw new ProviderError("quota", PROVIDER, body.error);
  // Google simply had nothing for this query: that's an empty result, not a failure.
  if (msg.includes("hasn't returned any results") || msg.includes("no results")) return {};
  if (msg.includes("expired") || msg.includes("invalid token") || msg.includes("booking_token") || msg.includes("departure_token")) throw new ProviderError("expired", PROVIDER, body.error);
  if (!res.ok || body.error) {
    console.error("SerpApi error", res.status, body.error?.slice(0, 200));
    throw new ProviderError(res.status === 400 ? "bad_request" : "unavailable", PROVIDER, body.error);
  }
  return body;
}

function baseParams(p: FlightSearchParams): Record<string, string> {
  return {
    departure_id: p.originCode,
    arrival_id: p.destinationCode,
    outbound_date: p.departDate,
    ...(p.returnDate ? { return_date: p.returnDate, type: "1" } : { type: "2" }),
    adults: String(p.adults),
    children: String(p.children),
    currency: p.currency,
    // "View more flights": without it Google returns only a handful of top picks (often only nonstops).
    show_hidden: "true",
    ...(p.nonstopOnly ? { stops: "1" } : {}),
  };
}

const toIso = (t?: string) => (t ? t.replace(" ", "T").slice(0, 16) : "");
const CABINS: Record<string, FlightOffer["cabin"]> = { economy: "Economy", "premium economy": "Premium Economy", business: "Business", first: "First" };
const color = (code: string) => `hsl(${hash(code) % 360} 55% 42%)`;

function segment(it: SerpItinerary): FlightSegment | null {
  const fl = it.flights ?? [];
  const first = fl[0];
  const last = fl[fl.length - 1];
  if (!first?.departure_airport?.id || !last?.arrival_airport?.id || !first.departure_airport.time || !last.arrival_airport.time) return null;
  return {
    from: first.departure_airport.id,
    to: last.arrival_airport.id,
    depart: toIso(first.departure_airport.time),
    arrive: toIso(last.arrival_airport.time),
    durationMin: it.total_duration ?? fl.reduce((a, f) => a + (f.duration ?? 0), 0),
    stops: Math.max(0, fl.length - 1),
    stopCodes: (it.layovers ?? []).map((l) => l.id ?? "").filter(Boolean),
    flightNumber: fl.map((f) => f.flight_number).filter(Boolean).join(", "),
    legs: fl.map((f) => ({
      flightNumber: f.flight_number ?? "",
      airline: f.airline ?? "",
      from: f.departure_airport?.id ?? "",
      to: f.arrival_airport?.id ?? "",
      depart: toIso(f.departure_airport?.time),
      arrive: toIso(f.arrival_airport?.time),
      durationMin: f.duration ?? 0,
      aircraft: f.airplane,
    })),
  };
}

/** Maps one Google Flights itinerary to an offer. Anything without a price, schedule or token is dropped, never guessed. */
export function toOffer(it: SerpItinerary, p: FlightSearchParams, fetchedAt: string, leg: "outbound" | "return" = "outbound"): FlightOffer | null {
  const seg = segment(it);
  const token = it.booking_token ?? it.departure_token;
  if (!seg || typeof it.price !== "number" || !Number.isFinite(it.price) || it.price <= 0 || !token) return null;
  const first = it.flights![0];
  const airlines = [...new Set(it.flights!.map((f) => f.airline).filter(Boolean))] as string[];
  const code = (first.flight_number ?? "").split(" ")[0] || (first.airline ?? "??").slice(0, 2).toUpperCase();
  const travelers = p.adults + p.children;
  const round = Boolean(p.returnDate);
  const notes = [
    ...(it.flights ?? []).flatMap((f) => (f.often_delayed_by_over_30_min ? [`${f.flight_number} is often delayed by 30+ min`] : [])),
    ...(it.layovers ?? []).filter((l) => l.overnight).map((l) => `Overnight layover in ${l.name ?? l.id}`),
  ];
  return {
    id: `gf_${hash(token).toString(36)}`,
    source: "live",
    provider: PROVIDER,
    airline: { code, name: airlines.join(" + ") || code, color: color(code), logo: it.airline_logo ?? first.airline_logo },
    outbound: seg,
    cabin: CABINS[(first.travel_class ?? "economy").toLowerCase()] ?? "Economy",
    totalPrice: Math.round(it.price),
    pricePerTraveler: Math.round(it.price / Math.max(1, travelers)),
    currency: p.currency,
    travelers,
    tripType: round ? "round" : "oneway",
    // Round-trip outbound results still need a return flight; picking one gives the booking token.
    returnPending: round && leg === "outbound" && !it.booking_token,
    booking: { provider: "serpapi", departureToken: it.departure_token, bookingToken: it.booking_token, params: p },
    fetchedAt,
    expiresAt: new Date(new Date(fetchedAt).getTime() + FRESH_MINUTES * 60_000).toISOString(),
    notes: notes.length ? notes : undefined,
    conditions: it.extensions?.filter((x) => typeof x === "string").slice(0, 5),
    searchUrl: flightSearchUrl(p.originCode, p.destinationCode, p.departDate, p.returnDate, p.adults, p.children),
  };
}

function offersFrom(body: SerpResponse, p: FlightSearchParams, fetchedAt: string, leg: "outbound" | "return") {
  const seen = new Set<string>();
  return [...(body.best_flights ?? []), ...(body.other_flights ?? [])]
    .map((it) => toOffer(it, p, fetchedAt, leg))
    .filter((o): o is FlightOffer => Boolean(o) && !seen.has(o!.id) && Boolean(seen.add(o!.id)));
}

/** Only Google's own booking redirect is accepted as a destination; anything else is dropped. */
export function safeBookingRequest(r?: { url?: string; post_data?: string }) {
  if (!r?.url || !r.post_data) return undefined;
  let u: URL;
  try {
    u = new URL(r.url);
  } catch {
    return undefined;
  }
  if (u.protocol !== "https:" || u.hostname !== "www.google.com" || !u.pathname.startsWith("/travel/clk")) return undefined;
  const fields = [...new URLSearchParams(r.post_data).entries()];
  return fields.length ? { url: u.toString(), fields } : undefined;
}

function choice(c: SerpBookingChoice | undefined, currency: string, leg?: "departing" | "returning"): BookingOption | null {
  if (!c?.book_with) return null;
  const request = safeBookingRequest(c.booking_request);
  if (!request && !c.booking_phone) return null;
  return {
    seller: c.book_with,
    isAirline: Boolean(c.airline),
    price: typeof c.price === "number" ? Math.round(c.price) : undefined,
    currency,
    fareName: c.option_title,
    details: [...(c.extensions ?? []), ...(c.baggage_prices ?? [])].slice(0, 6),
    request,
    phone: request ? undefined : c.booking_phone,
    leg,
  };
}

/** Cheapest first; on a tie, one ticket beats two, and the airline beats a travel site. */
function rankChoices(a: BookingChoice, b: BookingChoice) {
  const price = (a.total ?? Infinity) - (b.total ?? Infinity);
  if (price) return price;
  if (a.tickets.length !== b.tickets.length) return a.tickets.length - b.tickets.length;
  return Number(b.tickets[0].isAirline) - Number(a.tickets[0].isAirline);
}

export const serpApiFlights: FlightProvider & {
  returns(departureToken: string, p: FlightSearchParams): Promise<FlightOffer[]>;
  bookingOptions(bookingToken: string, p: FlightSearchParams): Promise<BookingChoice[]>;
} = {
  id: "serpapi",
  source: "live",
  async search(p) {
    const fetchedAt = new Date().toISOString();
    return offersFrom(await call(baseParams(p)), p, fetchedAt, "outbound");
  },
  async returns(departureToken, p) {
    const fetchedAt = new Date().toISOString();
    return offersFrom(await call({ ...baseParams(p), departure_token: departureToken }), p, fetchedAt, "return");
  },
  async bookingOptions(bookingToken, p) {
    // The token already names the itinerary; the full "View more flights" list isn't needed here.
    const { show_hidden: _, ...q } = baseParams(p);
    const body = await call({ ...q, booking_token: bookingToken });
    if (!body.booking_options?.length) throw new ProviderError("expired", PROVIDER, "No booking options returned");
    return body.booking_options
      .map((o): BookingChoice | null => {
        const tickets = o.separate_tickets ? [choice(o.departing, p.currency, "departing"), choice(o.returning, p.currency, "returning")] : [choice(o.together, p.currency)];
        // Half of a separate-ticket deal can't be booked on its own.
        if (tickets.some((t) => !t)) return null;
        const prices = tickets.map((t) => t!.price);
        const total = prices.every((x): x is number => typeof x === "number") ? prices.reduce((a, b) => a + b, 0) : undefined;
        return { tickets: tickets as BookingOption[], total, currency: p.currency };
      })
      .filter((c): c is BookingChoice => Boolean(c))
      .sort(rankChoices);
  },
};
