import type { FlightSearchParams, FlightSegment } from "@/lib/types";
import { ProviderError } from "./errors";

/**
 * Duffel: flights Pyrius can sell itself. Search returns bookable fares; after the traveller pays
 * (Stripe Checkout), the order is created with Duffel and paid from the Pyrius Duffel balance.
 * A test key (duffel_test_…) books with Duffel's sandbox: real-looking fares, no real tickets.
 * Server-side only: the access token never reaches the browser.
 */

const API = "https://api.duffel.com";

export const duffelEnabled = () => Boolean(process.env.DUFFEL_ACCESS_TOKEN);
export const duffelTestMode = () => (process.env.DUFFEL_ACCESS_TOKEN ?? "").startsWith("duffel_test_");

async function duffel<T>(path: string, body?: unknown, timeoutMs = 45_000): Promise<T> {
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  if (!token) throw new ProviderError("not_configured", "duffel");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, "Duffel-Version": "v2", Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify({ data: body }) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new ProviderError((err as Error).name === "TimeoutError" ? "timeout" : "unavailable", "duffel");
  }
  const json = (await res.json().catch(() => ({}))) as { data?: T; errors?: { code?: string; title?: string; message?: string }[] };
  if (!res.ok) {
    const e = json.errors?.[0];
    const code = res.status === 401 || res.status === 403 ? "auth" : res.status === 429 ? "quota" : e?.code === "offer_no_longer_available" || e?.code === "price_changed" ? "expired" : res.status === 422 || res.status === 400 ? "bad_request" : "unavailable";
    throw new DuffelError(code, e?.code ?? String(res.status), e?.message ?? e?.title ?? `Duffel ${res.status}`);
  }
  return json.data as T;
}

export class DuffelError extends ProviderError {
  constructor(code: ConstructorParameters<typeof ProviderError>[0], public duffelCode: string, message: string) {
    super(code, "duffel", message);
  }
}

/* ---------- Duffel shapes (only the fields Pyrius reads) ---------- */

interface DPlace { iata_code: string; city_name?: string | null }
interface DSegment {
  origin: DPlace;
  destination: DPlace;
  departing_at: string;
  arriving_at: string;
  duration?: string | null;
  marketing_carrier: { iata_code: string; name: string };
  marketing_carrier_flight_number: string;
  operating_carrier?: { name: string };
  aircraft?: { name: string } | null;
  passengers: { passenger_id: string; cabin_class_marketing_name?: string; baggages: { type: "checked" | "carry_on"; quantity: number }[] }[];
}
interface DSlice { origin: DPlace; destination: DPlace; duration?: string | null; fare_brand_name?: string | null; segments: DSegment[] }
interface DCondition { allowed: boolean; penalty_amount?: string | null; penalty_currency?: string | null }
interface DOffer {
  id: string;
  live_mode: boolean;
  expires_at: string;
  total_amount: string;
  total_currency: string;
  passenger_identity_documents_required: boolean;
  owner: { iata_code: string; name: string; logo_symbol_url?: string | null };
  slices: DSlice[];
  passengers: { id: string; type?: string | null; age?: number | null }[];
  conditions: { refund_before_departure?: DCondition | null; change_before_departure?: DCondition | null };
  payment_requirements?: { requires_instant_payment: boolean };
}

/* ---------- What the app sees ---------- */

export interface DuffelFare {
  id: string;
  /** Same flights, same fare brand: used to find this fare again in a fresh quote. */
  key: string;
  airline: { code: string; name: string; logo?: string };
  total: number;
  currency: string;
  slices: FlightSegment[];
  cabin: string;
  fareBrand?: string;
  baggage: { carryOn: number; checked: number };
  refund: string;
  change: string;
  expiresAt: string;
  passengers: { id: string; type: "adult" | "child" | "infant" }[];
  testMode: boolean;
}

const minutes = (iso?: string | null) => {
  const m = iso?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  return m ? Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
};
const local = (s: string) => s.slice(0, 16);

function rule(c: DCondition | null | undefined, what: string) {
  if (!c) return `${what} rules: ask the airline`;
  if (!c.allowed) return `No ${what.toLowerCase()}s`;
  const fee = Number(c.penalty_amount ?? 0);
  return fee > 0 ? `${what} for a ${fee.toFixed(0)} ${c.penalty_currency ?? ""} fee`.trim() : `Free ${what.toLowerCase()}`;
}

const segKey = (o: DOffer) => o.slices.map((s) => s.segments.map((g) => `${g.marketing_carrier.iata_code}${g.marketing_carrier_flight_number}@${local(g.departing_at)}`).join("+") + `#${s.fare_brand_name ?? ""}`).join("/");

function toFare(o: DOffer): DuffelFare {
  const first = o.slices[0]?.segments[0];
  const pax = first?.passengers[0];
  const bags = pax?.baggages ?? [];
  const typeOf = (p: DOffer["passengers"][number]): DuffelFare["passengers"][number]["type"] =>
    p.type === "infant_without_seat" ? "infant" : p.type === "adult" ? "adult" : p.age != null && p.age < 2 ? "infant" : p.age != null && p.age < 18 ? "child" : "adult";
  return {
    id: o.id,
    key: segKey(o),
    airline: { code: o.owner.iata_code, name: o.owner.name, logo: o.owner.logo_symbol_url ?? undefined },
    total: Number(o.total_amount),
    currency: o.total_currency,
    slices: o.slices.map((s) => {
      const segs = s.segments;
      const a = segs[0];
      const z = segs[segs.length - 1];
      return {
        from: s.origin.iata_code,
        to: s.destination.iata_code,
        depart: local(a.departing_at),
        arrive: local(z.arriving_at),
        durationMin: minutes(s.duration) || Math.round((Date.parse(z.arriving_at) - Date.parse(a.departing_at)) / 60000),
        stops: segs.length - 1,
        stopCodes: segs.slice(0, -1).map((g) => g.destination.iata_code),
        flightNumber: segs.map((g) => `${g.marketing_carrier.iata_code}${g.marketing_carrier_flight_number}`).join(", "),
        legs: segs.map((g) => ({
          flightNumber: `${g.marketing_carrier.iata_code}${g.marketing_carrier_flight_number}`,
          airline: g.operating_carrier?.name ?? g.marketing_carrier.name,
          from: g.origin.iata_code,
          to: g.destination.iata_code,
          depart: local(g.departing_at),
          arrive: local(g.arriving_at),
          durationMin: minutes(g.duration),
          aircraft: g.aircraft?.name,
        })),
      };
    }),
    cabin: pax?.cabin_class_marketing_name ?? "Economy",
    fareBrand: o.slices[0]?.fare_brand_name ?? undefined,
    baggage: { carryOn: bags.find((b) => b.type === "carry_on")?.quantity ?? 0, checked: bags.find((b) => b.type === "checked")?.quantity ?? 0 },
    refund: rule(o.conditions.refund_before_departure, "Refund"),
    change: rule(o.conditions.change_before_departure, "Change"),
    expiresAt: o.expires_at,
    passengers: o.passengers.map((p) => ({ id: p.id, type: typeOf(p) })),
    testMode: !o.live_mode,
  };
}

/* ---------- Search ---------- */

export type PaxAges = { adults: number; childAges: number[]; infants: number };

/** Children's ages aren't known at search time; 10 prices them as children until the traveller enters their birth dates. */
export const defaultAges = (p: FlightSearchParams): PaxAges => ({ adults: p.adults, childAges: Array(p.children).fill(10), infants: p.infants ?? 0 });

async function offerRequest(p: FlightSearchParams, ages: PaxAges): Promise<DOffer[]> {
  const slices = [{ origin: p.originCode, destination: p.destinationCode, departure_date: p.departDate }];
  if (p.returnDate) slices.push({ origin: p.destinationCode, destination: p.originCode, departure_date: p.returnDate });
  const passengers = [
    ...Array.from({ length: ages.adults }, () => ({ type: "adult" })),
    ...ages.childAges.map((age) => ({ age })),
    ...Array.from({ length: ages.infants }, () => ({ type: "infant_without_seat" })),
  ];
  const data = await duffel<{ offers: DOffer[] }>("/air/offer_requests?return_offers=true&supplier_timeout=20000", {
    slices,
    passengers,
    cabin_class: p.cabin ?? "economy",
    max_connections: p.nonstopOnly ? 0 : 1,
  });
  // Offers that need passport details at booking aren't sold in Pyrius yet.
  return (data.offers ?? []).filter((o) => !o.passenger_identity_documents_required && o.slices.every((s) => s.segments.length));
}

/**
 * Bookable fares for a search. When the card the user picked lists its flight numbers, the same
 * flights come first; otherwise (or also) the cheapest few, plus the cheapest on the card's airline.
 */
export async function duffelFares(p: FlightSearchParams, want?: { outbound?: string[]; inbound?: string[]; airline?: string }) {
  const offers = (await offerRequest(p, defaultAges(p))).sort((a, b) => Number(a.total_amount) - Number(b.total_amount));
  const nums = (s?: DSlice) => s?.segments.map((g) => `${g.marketing_carrier.iata_code}${g.marketing_carrier_flight_number}`.replace(/\s/g, "")) ?? [];
  const same = (a: string[], b?: string[]) => Boolean(b?.length) && a.length === b!.length && a.every((x, i) => x === b![i].replace(/\s/g, ""));
  const exact = want?.outbound?.length ? offers.find((o) => same(nums(o.slices[0]), want.outbound) && (!want.inbound?.length || same(nums(o.slices[1]), want.inbound))) : undefined;
  const picks: DOffer[] = [];
  const seen = new Set<string>();
  const add = (o?: DOffer) => {
    if (!o || seen.has(segKey(o))) return;
    seen.add(segKey(o));
    picks.push(o);
  };
  add(exact);
  for (const o of offers) if (picks.length < 4) add(o);
  if (want?.airline) add(offers.find((o) => o.owner.iata_code === want.airline || o.slices[0].segments[0].marketing_carrier.iata_code === want.airline));
  return { fares: picks.map(toFare), exact: Boolean(exact) };
}

/* ---------- Quote with real ages, then order ---------- */

export interface Traveller {
  title: "mr" | "ms" | "mrs" | "miss" | "dr";
  gender: "m" | "f";
  givenName: string;
  familyName: string;
  bornOn: string;
  email: string;
  phone: string;
}

/** Age on a date, from a birth date (both YYYY-MM-DD). */
export function ageOn(bornOn: string, date: string) {
  const [by, bm, bd] = bornOn.split("-").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/**
 * Prices the chosen fare again with the travellers' real ages (a child's fare depends on it, and
 * offers expire after about 30 minutes). Returns the same flights and fare brand, at today's price.
 */
export async function quote(p: FlightSearchParams, key: string, travellers: { kind: "adult" | "child" | "infant"; bornOn: string }[]) {
  const lastDay = p.returnDate ?? p.departDate;
  const ages: PaxAges = {
    adults: travellers.filter((t) => t.kind === "adult").length,
    childAges: travellers.filter((t) => t.kind === "child").map((t) => ageOn(t.bornOn, lastDay)),
    infants: travellers.filter((t) => t.kind === "infant").length,
  };
  const offers = await offerRequest(p, ages);
  const match = offers.filter((o) => segKey(o) === key).sort((a, b) => Number(a.total_amount) - Number(b.total_amount))[0];
  if (!match) throw new DuffelError("expired", "offer_no_longer_available", "These flights are no longer for sale at this fare.");
  return toFare(match);
}

/** Fetches one offer as it stands now (price included). */
export async function getOffer(id: string) {
  return toFare(await duffel<DOffer>(`/air/offers/${encodeURIComponent(id)}?return_available_services=false`));
}

export interface DuffelOrder {
  id: string;
  booking_reference: string;
  total_amount: string;
  total_currency: string;
  live_mode: boolean;
  owner: { name: string };
  passengers: { given_name: string; family_name: string }[];
  slices: DSlice[];
}

/**
 * Books the offer and pays it from the Duffel balance. Travellers are given in the offer's
 * passenger order; each infant travels on the lap of the adult at the same position.
 */
export async function createOrder(offer: { id: string; total: number; currency: string; passengers: DuffelFare["passengers"] }, travellers: Traveller[], metadata: Record<string, string>) {
  const adults = offer.passengers.filter((p) => p.type === "adult");
  const infants = offer.passengers.filter((p) => p.type === "infant");
  const passengers = offer.passengers.map((p, i) => {
    const t = travellers[i];
    const lap = p.type === "adult" ? infants[adults.indexOf(p)] : undefined;
    return {
      id: p.id,
      title: t.title,
      gender: t.gender,
      given_name: t.givenName,
      family_name: t.familyName,
      born_on: t.bornOn,
      email: t.email,
      phone_number: t.phone,
      ...(lap ? { infant_passenger_id: lap.id } : {}),
    };
  });
  return duffel<DuffelOrder>("/air/orders", {
    type: "instant",
    selected_offers: [offer.id],
    passengers,
    payments: [{ type: "balance", amount: offer.total.toFixed(2), currency: offer.currency }],
    metadata,
  });
}

export const getOrder = (id: string) => duffel<DuffelOrder>(`/air/orders/${encodeURIComponent(id)}`);

/** What the confirmation page shows. */
export function orderSummary(o: DuffelOrder) {
  return {
    reference: o.booking_reference,
    airline: o.owner.name,
    total: Number(o.total_amount),
    currency: o.total_currency,
    testMode: !o.live_mode,
    passengers: o.passengers.map((p) => `${p.given_name} ${p.family_name}`),
    slices: o.slices.map((s) => ({
      from: s.origin.iata_code,
      to: s.destination.iata_code,
      depart: local(s.segments[0].departing_at),
      arrive: local(s.segments[s.segments.length - 1].arriving_at),
      flights: s.segments.map((g) => `${g.marketing_carrier.iata_code}${g.marketing_carrier_flight_number}`).join(", "),
    })),
  };
}
export type OrderSummary = ReturnType<typeof orderSummary>;
