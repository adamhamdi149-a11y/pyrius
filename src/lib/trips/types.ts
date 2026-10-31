/**
 * My Trips: the user's travel reservations, grouped by trip. Reservations only ever come from a
 * booking provider's confirmation (written by the Pyrius server, never by the app), so a trip can
 * never show a booking that doesn't exist. Trips themselves can also be created by the user to plan.
 *
 * Providers this is designed for (not connected yet):
 * - Duffel: flight search, booking and order changes. A Duffel order becomes a FlightReservation.
 * - Booking.com: hotel and rental car search and booking. A booking becomes a HotelReservation or CarReservation.
 */

export type ReservationKind = "flight" | "hotel" | "car";
export type BookingProvider = "duffel" | "booking.com";
export type ReservationStatus = "confirmed" | "pending" | "changed" | "cancelled";

interface ReservationBase {
  id: string;
  kind: ReservationKind;
  provider: BookingProvider;
  /** The provider's own id for the order or booking (Duffel order id, Booking.com reservation id). */
  providerRef: string;
  /** The code the traveller quotes to the airline, hotel or rental company. */
  confirmationCode?: string;
  status: ReservationStatus;
  bookedAt: string;
  totalPrice?: number;
  currency?: string;
  /** The provider's page to view or change the booking. */
  manageUrl?: string;
}

export interface FlightSegment {
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  /** Local time at the airport, ISO without offset (as airlines print it). */
  departAt: string;
  arriveAt: string;
  cabin?: string;
}

export interface FlightReservation extends ReservationBase {
  kind: "flight";
  segments: FlightSegment[];
  passengers: string[];
}

export interface HotelReservation extends ReservationBase {
  kind: "hotel";
  name: string;
  address?: string;
  city: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  roomType?: string;
}

export interface CarReservation extends ReservationBase {
  kind: "car";
  company: string;
  vehicle?: string;
  pickUp: { place: string; at: string };
  dropOff: { place: string; at: string };
}

export type Reservation = FlightReservation | HotelReservation | CarReservation;

export interface Trip {
  id: string;
  /** Where the trip goes, as shown ("Lisbon"). */
  destination: string;
  /** Airport or city code, when known: links the trip to flight searches and bookings. */
  destinationCode?: string;
  country?: string;
  /** YYYY-MM-DD. Optional while planning. */
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  /** Who created it: the user while planning, or a booking. */
  origin: "user" | "booking";
  reservations: Reservation[];
}

export type TripStatus = "planning" | "booked" | "upcoming" | "ongoing" | "completed" | "cancelled";
