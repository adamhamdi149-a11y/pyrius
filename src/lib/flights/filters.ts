import type { FlightOffer } from "@/lib/types";

/** Filtering and ordering of flight offers, shared by the web cards, the mobile cards and the AI's view of them. */

export type Sort = "price" | "duration" | "depart" | "stops";
export type Stops = "any" | "0" | "1";
export type Window = "any" | "morning" | "afternoon" | "evening";

export interface Filters {
  sort: Sort;
  stops: Stops;
  window: Window;
  airlines: string[]; // empty = all
  maxPrice: number | null;
  carryOn: boolean;
}

export const WINDOWS: Record<Exclude<Window, "any">, [number, number, string]> = {
  morning: [5, 12, "Morning · 5–12"],
  afternoon: [12, 18, "Afternoon · 12–18"],
  evening: [18, 24, "Evening · 18–24"],
};

const hourOf = (iso: string) => Number(iso.slice(11, 13));

export function applyFlightFilters(offers: FlightOffer[], f: Filters) {
  const list = offers.filter((o) => {
    if (f.stops === "0" && o.outbound.stops > 0) return false;
    if (f.stops === "1" && o.outbound.stops > 1) return false;
    if (f.window !== "any") {
      const [a, b] = WINDOWS[f.window];
      const h = hourOf(o.outbound.depart);
      if (h < a || h >= b) return false;
    }
    if (f.airlines.length && !f.airlines.includes(o.airline.code)) return false;
    if (f.maxPrice !== null && o.totalPrice > f.maxPrice) return false;
    if (f.carryOn && o.baggage && !o.baggage.carryOn) return false;
    return true;
  });
  const total = (o: FlightOffer) => o.outbound.durationMin + (o.inbound?.durationMin ?? 0);
  const stops = (o: FlightOffer) => o.outbound.stops + (o.inbound?.stops ?? 0);
  return list.sort((a, b) =>
    f.sort === "duration"
      ? total(a) - total(b) || a.totalPrice - b.totalPrice
      : f.sort === "depart"
        ? a.outbound.depart.localeCompare(b.outbound.depart)
        : f.sort === "stops"
          ? stops(a) - stops(b) || a.totalPrice - b.totalPrice
          : a.totalPrice - b.totalPrice,
  );
}
