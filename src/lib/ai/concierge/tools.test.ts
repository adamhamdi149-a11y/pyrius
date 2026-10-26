import { describe, expect, it } from "vitest";
import { nextStep } from "@/lib/flights/workflow";
import type { TripPreferences } from "@/lib/types";
import { applyTripUpdate } from "./tools";

/**
 * The AI only proposes values through update_trip; these check that the application validates and
 * commits them the same way the workflow does, whatever the model sends.
 */

const TODAY = "2026-10-26";
const nulls = {
  origin_code: null, destination_code: null, origin_query: null, destination_query: null, depart_date: null, return_date: null, trip_length_days: null,
  calendar_month: null, trip_type: null, legs: null, flexible_dates: null, adults: null, children: null, infants: null, cabin: null, budget_amount: null,
  budget_basis: null, nonstop_only: null, carry_on_only: null, departure_time: null, priority: null, rooms: null, stay_type: null, stay_budget_per_night: null,
  notes: null, clear: [],
};
const start: TripPreferences = { currency: "USD" };
const update = (prev: TripPreferences, args: Record<string, unknown>) => applyTripUpdate(prev, { ...nulls, ...args }, TODAY);

describe("trip extraction", () => {
  it("takes a full request in one message", () => {
    // "Find me a business-class flight from Montreal to Dubai on December 12, returning December 20, for two adults."
    const r = update(start, { origin_code: "YUL", destination_code: "DXB", depart_date: "2026-12-12", return_date: "2026-12-20", adults: 2, cabin: "business", trip_type: "round_trip" });
    expect(r.issues).toEqual([]);
    expect(r.trip).toMatchObject({ originCode: "YUL", destinationCode: "DXB", departDate: "2026-12-12", returnDate: "2026-12-20", adults: 2, cabin: "business", tripType: "round" });
    expect(nextStep(r.trip, false)).toBe("ready");
  });

  it("asks only for the departure when the rest is known", () => {
    // "Find me a flight to Paris next Friday"
    const r = update(start, { destination_code: "CDG", depart_date: "2026-10-30" });
    expect(nextStep(r.trip, false)).toBe("origin");
  });

  it("keeps a country as a question, not an airport", () => {
    // "I want to fly to Japan"
    const r = update(start, { destination_query: "Japan" });
    expect(r.trip.destinationCode).toBeUndefined();
    expect(r.trip.destinationQuery).toBe("Japan");
    expect(nextStep(r.trip, false)).toBe("destination");
  });

  it("records 'cheapest' as a priority, not a date or cabin", () => {
    const r = update(start, { priority: "cheapest" });
    expect(r.trip).toMatchObject({ priority: "cheapest" });
    expect(r.trip.departDate).toBeUndefined();
    expect(r.trip.cabin).toBeUndefined();
  });

  it("a correction changes one field and keeps the others", () => {
    const first = update(start, { origin_code: "YUL", destination_code: "DXB", depart_date: "2026-12-12", return_date: "2026-12-20", adults: 2 }).trip;
    const r = update(first, { destination_code: "DOH" });
    expect(r.trip).toMatchObject({ originCode: "YUL", destinationCode: "DOH", departDate: "2026-12-12", returnDate: "2026-12-20", adults: 2 });
  });

  it("rejects invented airport codes and impossible dates", () => {
    const r = update(start, { destination_code: "QQQ", depart_date: "2026-02-31" });
    expect(r.trip.destinationCode).toBeUndefined();
    expect(r.trip.departDate).toBeUndefined();
    expect(r.issues.length).toBe(2);
  });

  it("rejects a return before the departure but allows a same-day return", () => {
    expect(update(start, { depart_date: "2026-12-12", return_date: "2026-12-10" }).trip.returnDate).toBeUndefined();
    expect(update(start, { depart_date: "2026-12-12", return_date: "2026-12-12" }).trip.returnDate).toBe("2026-12-12");
  });

  it("rejects more lap infants than adults", () => {
    const r = update({ ...start, adults: 1 }, { infants: 2 });
    expect(r.issues.length).toBe(1);
    expect(r.trip.infants).toBeUndefined();
  });

  it("one way drops the return date", () => {
    const r = update({ ...start, departDate: "2026-12-12", returnDate: "2026-12-20" }, { trip_type: "one_way" });
    expect(r.trip.returnDate).toBeUndefined();
    expect(r.trip.departDate).toBe("2026-12-12");
  });

  it("builds a multi-city route", () => {
    const r = update(start, {
      trip_type: "multi_city",
      legs: [
        { from_code: "YUL", to_code: "CDG", date: "2026-12-01" },
        { from_code: "CDG", to_code: "FCO", date: "2026-12-05" },
        { from_code: "FCO", to_code: "YUL", date: "2026-12-10" },
      ],
    });
    expect(r.trip.tripType).toBe("multi");
    expect(r.trip.legs).toHaveLength(3);
    expect(nextStep(r.trip, false)).toBe("ready");
  });

  it("keeps a month hint without inventing dates", () => {
    const r = update(start, { calendar_month: "2027-04" });
    expect(r.trip.calendarMonth).toBe("2027-04");
    expect(r.trip.departDate).toBeUndefined();
  });
});
