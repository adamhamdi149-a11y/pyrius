import { describe, expect, it } from "vitest";
import { byKind, placeReservation, sortTrips, tripDates, tripStatus } from "./organize";
import { fromDuffelOrder, type DuffelOrder } from "./providers/duffel";
import type { HotelReservation, Trip } from "./types";

const order: DuffelOrder = {
  id: "ord_0000AXqKbq3Q1vQJ9R",
  booking_reference: "RZPNX8",
  created_at: "2026-11-02T10:00:00Z",
  total_amount: "812.40",
  total_currency: "CAD",
  slices: [
    { segments: [{ origin: { iata_code: "YUL" }, destination: { iata_code: "LIS" }, departing_at: "2027-05-10T21:40:00", arriving_at: "2027-05-11T09:30:00", marketing_carrier: { name: "TAP Air Portugal", iata_code: "TP" }, marketing_carrier_flight_number: "256", passengers: [{ cabin_class_marketing_name: "Economy" }] }] },
    { segments: [{ origin: { iata_code: "LIS" }, destination: { iata_code: "YUL" }, departing_at: "2027-05-20T12:10:00", arriving_at: "2027-05-20T14:40:00", marketing_carrier: { name: "TAP Air Portugal", iata_code: "TP" }, marketing_carrier_flight_number: "257" }] },
  ],
  passengers: [{ given_name: "Adam", family_name: "Hamdi" }],
};

const hotel: HotelReservation = {
  id: "bkg_1", kind: "hotel", provider: "booking.com", providerRef: "4412", confirmationCode: "4412.118.553", status: "confirmed", bookedAt: "2026-11-03T10:00:00Z",
  name: "Hotel Avenida", city: "Lisbon", checkIn: "2027-05-11", checkOut: "2027-05-20", rooms: 1, guests: 1,
};

describe("My Trips", () => {
  it("turns a Duffel order into a flight reservation", () => {
    const r = fromDuffelOrder(order);
    expect(r).toMatchObject({ provider: "duffel", providerRef: order.id, confirmationCode: "RZPNX8", status: "confirmed", totalPrice: 812.4, currency: "CAD", passengers: ["Adam Hamdi"] });
    expect(r.segments.map((s) => `${s.flightNumber} ${s.from}-${s.to}`)).toEqual(["TP256 YUL-LIS", "TP257 LIS-YUL"]);
    expect(fromDuffelOrder({ ...order, cancelled_at: "2026-12-01T00:00:00Z" }).status).toBe("cancelled");
  });

  it("starts a trip for a first booking, then files the hotel under it", () => {
    let trips: Trip[] = placeReservation([], fromDuffelOrder(order), { id: "t1", now: "2026-11-02T10:00:00Z", destination: "Lisbon" });
    expect(trips).toHaveLength(1);
    expect(trips[0]).toMatchObject({ destination: "Lisbon", destinationCode: "LIS", startDate: "2027-05-10", endDate: "2027-05-20", origin: "booking" });
    trips = placeReservation(trips, hotel, { id: "t2", now: "2026-11-03T10:00:00Z" });
    expect(trips).toHaveLength(1);
    expect(byKind(trips[0], "hotel")).toHaveLength(1);
    expect(byKind(trips[0], "car")).toHaveLength(0);
  });

  it("files a booking under a trip the user planned for the same place and dates", () => {
    const plan: Trip = { id: "p1", destination: "Lisbon", destinationCode: "LIS", startDate: "2027-05-09", endDate: "2027-05-21", createdAt: "x", updatedAt: "x", origin: "user", reservations: [] };
    const trips = placeReservation([plan], fromDuffelOrder(order), { id: "t1", now: "now" });
    expect(trips).toHaveLength(1);
    expect(trips[0].reservations).toHaveLength(1);
    // A different destination on the same dates is a different trip.
    const tokyo = { ...plan, id: "p2", destination: "Tokyo", destinationCode: "HND" };
    expect(placeReservation([tokyo], fromDuffelOrder(order), { id: "t3", now: "now" })).toHaveLength(2);
  });

  it("updates a changed booking in place instead of adding it twice", () => {
    let trips = placeReservation([], fromDuffelOrder(order), { id: "t1", now: "a" });
    trips = placeReservation(trips, fromDuffelOrder({ ...order, cancelled_at: "2026-12-01T00:00:00Z" }), { id: "t2", now: "b" });
    expect(trips).toHaveLength(1);
    expect(trips[0].reservations).toHaveLength(1);
    expect(tripStatus(trips[0], "2027-01-01")).toBe("cancelled");
  });

  it("knows where each trip stands and sorts them", () => {
    const trip = placeReservation([], fromDuffelOrder(order), { id: "t1", now: "a" })[0];
    expect(tripStatus(trip, "2027-01-01")).toBe("upcoming");
    expect(tripStatus(trip, "2027-05-15")).toBe("ongoing");
    expect(tripStatus(trip, "2027-06-01")).toBe("completed");
    const plan: Trip = { id: "p", destination: "Kyoto", createdAt: "a", updatedAt: "a", origin: "user", reservations: [] };
    expect(tripStatus(plan, "2027-01-01")).toBe("planning");
    expect(tripDates(plan)).toEqual({ start: undefined, end: undefined });
    const sorted = sortTrips([plan, trip], "2027-06-01");
    expect(sorted.upcoming.map((t) => t.id)).toEqual(["p"]);
    expect(sorted.past.map((t) => t.id)).toEqual(["t1"]);
  });
});
