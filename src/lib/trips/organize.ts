import type { Reservation, ReservationKind, Trip, TripStatus } from "./types";

/**
 * How reservations are organised into trips. When a booking is confirmed (by Duffel or
 * Booking.com, through the Pyrius server), `placeReservation` files it under the trip it belongs to,
 * or starts a new trip for it. Pure functions: the same input always gives the same trips.
 */

const day = (iso: string) => iso.slice(0, 10);
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The dates a reservation covers. */
export function reservationDates(r: Reservation): { start: string; end: string } {
  if (r.kind === "flight") return { start: day(r.segments[0]?.departAt ?? r.bookedAt), end: day(r.segments.at(-1)?.arriveAt ?? r.bookedAt) };
  if (r.kind === "hotel") return { start: r.checkIn, end: r.checkOut };
  return { start: day(r.pickUp.at), end: day(r.dropOff.at) };
}

/** Where a reservation takes the traveller: the outbound flight's arrival, or the hotel or car's place. */
export function reservationPlace(r: Reservation): string | undefined {
  if (r.kind === "flight") {
    // A round trip's destination is the last arrival before the flights head back to the start.
    const origin = r.segments[0]?.from;
    const away = r.segments.filter((s) => s.to !== origin);
    return away.at(-1)?.to ?? r.segments.at(-1)?.to;
  }
  return undefined;
}

/** Days of slack around a trip when matching a booking to it (a hotel the night before, a car the day after). */
const SLACK_DAYS = 2;

const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start <= addDays(b.end, SLACK_DAYS) && b.start <= addDays(a.end, SLACK_DAYS);

/** The trip's dates, from its own dates or its reservations. */
export function tripDates(t: Trip): { start?: string; end?: string } {
  const all = t.reservations.filter((r) => r.status !== "cancelled").map(reservationDates);
  const starts = [t.startDate, ...all.map((d) => d.start)].filter(Boolean) as string[];
  const ends = [t.endDate, ...all.map((d) => d.end)].filter(Boolean) as string[];
  return { start: starts.sort()[0], end: ends.sort().at(-1) };
}

/**
 * Files a confirmed reservation under its trip: the same trip if it's an update to a booking already
 * there, else a trip to the same place (when known) with overlapping dates, else a new trip.
 */
export function placeReservation(trips: Trip[], r: Reservation, make: { id: string; now: string; destination?: string; country?: string }): Trip[] {
  const holder = trips.find((t) => t.reservations.some((x) => x.provider === r.provider && x.providerRef === r.providerRef));
  if (holder) {
    return trips.map((t) => (t === holder ? { ...t, reservations: t.reservations.map((x) => (x.provider === r.provider && x.providerRef === r.providerRef ? r : x)), updatedAt: make.now } : t));
  }
  const when = reservationDates(r);
  const code = reservationPlace(r);
  const match = trips.find((t) => {
    const d = tripDates(t);
    const datesFit = d.start && d.end ? overlaps(when, { start: d.start, end: d.end }) : false;
    const placeFits = !code || !t.destinationCode || t.destinationCode === code;
    return datesFit && placeFits;
  });
  if (match) return trips.map((t) => (t === match ? { ...t, destinationCode: t.destinationCode ?? code, reservations: [...t.reservations, r], updatedAt: make.now } : t));
  const trip: Trip = {
    id: make.id,
    destination: make.destination ?? code ?? "",
    destinationCode: code,
    country: make.country,
    startDate: when.start,
    endDate: when.end,
    createdAt: make.now,
    updatedAt: make.now,
    origin: "booking",
    reservations: [r],
  };
  return [...trips, trip];
}

/** Where a trip stands today. */
export function tripStatus(t: Trip, today: string): TripStatus {
  const live = t.reservations.filter((r) => r.status !== "cancelled");
  if (t.reservations.length && !live.length) return "cancelled";
  const { start, end } = tripDates(t);
  if (end && end < today) return "completed";
  if (start && start <= today && (!end || end >= today)) return "ongoing";
  if (!live.length) return "planning";
  return start ? "upcoming" : "booked";
}

export const byKind = <K extends ReservationKind>(t: Trip, kind: K) => t.reservations.filter((r): r is Extract<Reservation, { kind: K }> => r.kind === kind);

/** Upcoming and ongoing trips soonest first, then plans without dates, then past trips most recent first. */
export function sortTrips(trips: Trip[], today: string) {
  const past = (t: Trip) => ["completed", "cancelled"].includes(tripStatus(t, today));
  const start = (t: Trip) => tripDates(t).start ?? "9999";
  return {
    upcoming: trips.filter((t) => !past(t)).sort((a, b) => start(a).localeCompare(start(b)) || b.updatedAt.localeCompare(a.updatedAt)),
    past: trips.filter(past).sort((a, b) => start(b).localeCompare(start(a))),
  };
}
