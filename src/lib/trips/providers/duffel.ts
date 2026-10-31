import type { FlightReservation, ReservationStatus } from "../types";

/**
 * Duffel (flight search and booking): turns a Duffel order into a FlightReservation. Runs on the
 * Pyrius server when an order is created or changes (Duffel webhook), never in the app. Not connected
 * yet: this is the integration point, written against Duffel's documented order shape.
 */

interface DuffelPlace {
  iata_code: string;
}
interface DuffelSegment {
  origin: DuffelPlace;
  destination: DuffelPlace;
  departing_at: string;
  arriving_at: string;
  marketing_carrier: { name: string; iata_code: string };
  marketing_carrier_flight_number: string;
  passengers?: { cabin_class_marketing_name?: string }[];
}
export interface DuffelOrder {
  id: string;
  booking_reference: string;
  created_at: string;
  total_amount: string;
  total_currency: string;
  cancelled_at?: string | null;
  slices: { segments: DuffelSegment[] }[];
  passengers: { given_name: string; family_name: string }[];
  /** Set when the airline has changed the schedule and the change awaits review. */
  available_actions?: string[];
}

export function fromDuffelOrder(order: DuffelOrder): FlightReservation {
  const status: ReservationStatus = order.cancelled_at ? "cancelled" : order.available_actions?.includes("accept_airline_initiated_change") ? "changed" : "confirmed";
  return {
    id: `duffel_${order.id}`,
    kind: "flight",
    provider: "duffel",
    providerRef: order.id,
    confirmationCode: order.booking_reference,
    status,
    bookedAt: order.created_at,
    totalPrice: Number(order.total_amount),
    currency: order.total_currency,
    segments: order.slices.flatMap((s) =>
      s.segments.map((g) => ({
        airline: g.marketing_carrier.name,
        flightNumber: `${g.marketing_carrier.iata_code}${g.marketing_carrier_flight_number}`,
        from: g.origin.iata_code,
        to: g.destination.iata_code,
        departAt: g.departing_at,
        arriveAt: g.arriving_at,
        cabin: g.passengers?.[0]?.cabin_class_marketing_name,
      })),
    ),
    passengers: order.passengers.map((p) => `${p.given_name} ${p.family_name}`),
  };
}
