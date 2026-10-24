import type { FlightOffer } from "@/lib/types";

/** A compact description of one flight offer, as the AI sees it. Built the same way on the server and in the app. */
export interface FlightBrief {
  n: number;
  id: string;
  airline: string;
  out: string;
  back: string | null;
  price: number;
  per_traveler: number;
  currency: string;
  cabin: string;
  bags: string | null;
  stops: number;
  duration_min: number;
  /** Round-trip price whose return flight the user picks when booking. */
  return_chosen_at_booking: boolean;
  notes: string[];
  /** Fare facts from the provider, such as baggage fees or refund rules. */
  conditions: string[];
}

const hm = (iso: string) => iso.slice(11, 16);
const dur = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
const leg = (s: FlightOffer["outbound"]) =>
  `${s.from} ${s.depart.slice(0, 10)} ${hm(s.depart)} → ${s.to} ${hm(s.arrive)}, ${dur(s.durationMin)}, ${s.stops ? `${s.stops} stop${s.stops > 1 ? "s" : ""} (${s.stopCodes.join(", ")})` : "nonstop"}`;

export function flightBrief(o: FlightOffer, n: number): FlightBrief {
  return {
    n,
    id: o.id,
    airline: o.airline.name,
    out: leg(o.outbound),
    back: o.inbound ? leg(o.inbound) : null,
    price: o.totalPrice,
    per_traveler: o.pricePerTraveler,
    currency: o.currency,
    cabin: o.cabin,
    bags: o.baggage ? `${o.baggage.carryOn ? "carry-on included" : "no carry-on"}, ${o.baggage.checked} checked` : null,
    stops: o.outbound.stops + (o.inbound?.stops ?? 0),
    duration_min: o.outbound.durationMin + (o.inbound?.durationMin ?? 0),
    return_chosen_at_booking: Boolean(o.returnPending),
    notes: o.notes ?? [],
    conditions: o.conditions ?? [],
  };
}
