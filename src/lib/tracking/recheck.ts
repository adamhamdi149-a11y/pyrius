import { serpApiHotels } from "@/lib/providers";
import { ProviderError } from "@/lib/providers/errors";
import { searchFlights } from "@/lib/providers/flightSearch";
import type { FlightOffer, HotelOffer } from "@/lib/types";
import type { CheckResult } from "./trackers";

/**
 * Looks a tracked offer up again with its live provider and returns today's price for that exact
 * offer, or that it's no longer sold. Server-side only; each call is one provider search
 * (identical searches within a few minutes share one).
 */

/** The fields a flight re-check needs: the search, and which flight it was. */
export type FlightRef = Pick<FlightOffer, "outbound" | "inbound"> & { booking: { params: NonNullable<FlightOffer["booking"]>["params"] } };
/** The fields a stay re-check needs: the property and the search. */
export type StayRef = Required<Pick<HotelOffer, "propertyToken" | "params">>;

const sameFlight = (a: Pick<FlightOffer, "outbound" | "inbound">, b: Pick<FlightOffer, "outbound" | "inbound">) =>
  a.outbound.flightNumber === b.outbound.flightNumber && a.outbound.depart === b.outbound.depart && (a.inbound?.flightNumber ?? "") === (b.inbound?.flightNumber ?? "");

export async function recheckFlight(f: FlightRef): Promise<CheckResult> {
  const snap = await searchFlights(f.booking.params);
  const at = snap.fetchedAt;
  const match = snap.offers.filter((o) => sameFlight(o, f)).sort((x, y) => x.totalPrice - y.totalPrice)[0];
  return match ? { available: true, price: match.totalPrice, at } : { available: false, at };
}

export async function recheckStay(h: StayRef): Promise<CheckResult> {
  const at = new Date().toISOString();
  try {
    const sellers = await serpApiHotels.sellers(h.propertyToken, h.params);
    const lowest = Math.min(...sellers.map((s) => s.total ?? Infinity));
    return Number.isFinite(lowest) ? { available: true, price: lowest, at } : { available: false, at };
  } catch (err) {
    if (err instanceof ProviderError && err.code === "expired") return { available: false, at };
    throw err;
  }
}
