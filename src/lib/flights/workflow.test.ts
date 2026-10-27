import { describe, expect, it } from "vitest";
import type { TripPreferences } from "@/lib/types";
import {
  canSearch,
  departProblem,
  missingFields,
  nextStep,
  resultsMatch,
  returnProblem,
  searchPlan,
  searchProblems,
  setCabin,
  setDates,
  setDestination,
  setOrigin,
  setTravelers,
  setTripKind,
  swapAirports,
  travelerBounds,
  travelersProblem,
} from "./workflow";

const TODAY = "2026-10-26";
const empty: TripPreferences = { currency: "USD" };
const full: TripPreferences = { currency: "USD", originCode: "YUL", destinationCode: "DXB", departDate: "2026-12-12", returnDate: "2026-12-20", adults: 2, cabin: "business" };

describe("questioning sequence", () => {
  it("asks for the destination first, then the departure airport, then dates", () => {
    expect(nextStep(empty, false)).toBe("destination");
    const a = setDestination(empty, "DXB").trip;
    expect(nextStep(a, false)).toBe("origin");
    const b = setOrigin(a, "YUL").trip;
    expect(nextStep(b, false)).toBe("dates");
    const c = setDates(b, "2026-12-12", "2026-12-20", TODAY).trip;
    expect(nextStep(c, false)).toBe("ready");
    expect(nextStep(c, true)).toBe("results");
  });

  it("never asks for something already known", () => {
    const knowsOrigin = { ...empty, originCode: "YUL" };
    expect(nextStep(knowsOrigin, false)).toBe("destination");
    expect(nextStep(setDestination(knowsOrigin, "CDG").trip, false)).toBe("dates");
  });

  it("goes straight to search when the first message had everything", () => {
    expect(missingFields(full)).toEqual([]);
    expect(nextStep(full, false)).toBe("ready");
    expect(canSearch(full, TODAY)).toBe(true);
  });

  it("asks only for the return date when that's all that's missing", () => {
    const t = { ...full, returnDate: undefined };
    expect(missingFields(t)).toEqual(["returnDate"]);
    expect(nextStep(t, false)).toBe("dates");
  });

  it("doesn't need a return date for one way", () => {
    const t = setTripKind({ ...full }, "oneway");
    expect(t.returnDate).toBeUndefined();
    expect(missingFields(t)).toEqual([]);
    expect(searchPlan(t, TODAY)[0].returnDate).toBeUndefined();
  });

  it("doesn't need travelers or cabin before searching (visible defaults)", () => {
    const t = { currency: "USD" as const, originCode: "YUL", destinationCode: "CDG", departDate: "2026-12-01", returnDate: "2026-12-08" };
    expect(canSearch(t, TODAY)).toBe(true);
    expect(searchPlan(t, TODAY)[0]).toMatchObject({ adults: 1, children: 0, cabin: undefined });
  });
});

describe("corrections", () => {
  it("changing the destination keeps everything else", () => {
    const t = setDestination(full, "LHR").trip;
    expect(t).toMatchObject({ originCode: "YUL", destinationCode: "LHR", departDate: "2026-12-12", returnDate: "2026-12-20", adults: 2, cabin: "business" });
  });

  it("makes results for the old trip stale", () => {
    const before = searchPlan(full, TODAY);
    expect(resultsMatch(full, before, TODAY)).toBe(true);
    expect(resultsMatch(setDestination(full, "LHR").trip, before, TODAY)).toBe(false);
    expect(resultsMatch(setCabin(full, "economy"), before, TODAY)).toBe(false);
    expect(resultsMatch(setTravelers(full, { adults: 2, children: 1, infants: 0 }).trip, before, TODAY)).toBe(false);
  });

  it("refuses the same airport at both ends", () => {
    expect(setDestination({ ...empty, originCode: "YUL" }, "YUL").error).toBeTruthy();
    expect(setOrigin({ ...empty, destinationCode: "YUL" }, "YUL").error).toBeTruthy();
  });

  it("swaps origin and destination", () => {
    expect(swapAirports(full)).toMatchObject({ originCode: "DXB", destinationCode: "YUL" });
  });
});

describe("dates", () => {
  it("rejects past dates and dates too far ahead", () => {
    expect(departProblem("2026-10-25", TODAY)).toBeTruthy();
    expect(departProblem(TODAY, TODAY)).toBeNull();
    expect(departProblem("2028-01-01", TODAY)).toBeTruthy();
  });

  it("requires the return on or after the departure", () => {
    expect(returnProblem("2026-12-12", "2026-12-11", TODAY)).toBeTruthy();
    expect(returnProblem("2026-12-12", "2026-12-12", TODAY)).toBeNull();
  });

  it("clears a return that's before a new departure", () => {
    const t = setDates(full, "2026-12-22", undefined, TODAY).trip;
    expect(t.departDate).toBe("2026-12-22");
    expect(t.returnDate).toBeUndefined();
    expect(nextStep(t, false)).toBe("dates");
  });

  it("keeps a return that's still after a new departure", () => {
    expect(setDates(full, "2026-12-14", undefined, TODAY).trip.returnDate).toBe("2026-12-20");
  });

  it("won't commit a past departure", () => {
    const r = setDates(full, "2026-01-01", undefined, TODAY);
    expect(r.error).toBeTruthy();
    expect(r.trip).toBe(full);
  });
});

describe("travelers", () => {
  it("needs an adult, an adult per lap infant, and at most 9 travelers", () => {
    expect(travelersProblem({ adults: 0, children: 1, infants: 0 })).toBeTruthy();
    expect(travelersProblem({ adults: 1, children: 0, infants: 2 })).toBeTruthy();
    expect(travelersProblem({ adults: 5, children: 5, infants: 0 })).toBeTruthy();
    expect(travelersProblem({ adults: 2, children: 3, infants: 2 })).toBeNull();
  });

  it("limits the steppers to valid combinations", () => {
    const b = travelerBounds({ adults: 1, children: 0, infants: 1 });
    expect(b.infants.add).toBe(false);
    expect(b.adults.remove).toBe(false);
    expect(travelerBounds({ adults: 4, children: 5, infants: 0 }).children.add).toBe(false);
  });

  it("an invalid change leaves the trip as it was", () => {
    const r = setTravelers(full, { adults: 1, children: 0, infants: 3 });
    expect(r.error).toBeTruthy();
    expect(r.trip.adults).toBe(2);
  });

  it("passes travelers and cabin to the search", () => {
    const t = setTravelers(full, { adults: 2, children: 1, infants: 1 }).trip;
    expect(searchPlan(t, TODAY)[0]).toMatchObject({ adults: 2, children: 1, infants: 1, cabin: "business" });
  });
});

describe("multi-city", () => {
  it("uses the route editor and searches each flight", () => {
    const t = setTripKind(full, "multi");
    expect(t.legs).toHaveLength(2);
    expect(nextStep(t, false)).toBe("legs");
    const done = { ...t, legs: [{ from: "YUL", to: "DXB", date: "2026-12-12" }, { from: "DXB", to: "BKK", date: "2026-12-16" }, { from: "BKK", to: "YUL", date: "2026-12-22" }] };
    expect(nextStep(done, false)).toBe("ready");
    expect(searchPlan(done, TODAY).map((p) => `${p.originCode}-${p.destinationCode}`)).toEqual(["YUL-DXB", "DXB-BKK", "BKK-YUL"]);
  });

  it("refuses flights out of order", () => {
    const t: TripPreferences = { ...full, tripType: "multi", legs: [{ from: "YUL", to: "DXB", date: "2026-12-12" }, { from: "DXB", to: "BKK", date: "2026-12-10" }] };
    expect(searchProblems(t, TODAY).length).toBeGreaterThan(0);
  });

  it("going back to round trip keeps the first flight", () => {
    const multi: TripPreferences = { ...empty, tripType: "multi", legs: [{ from: "YUL", to: "CDG", date: "2026-12-01" }, { from: "CDG", to: "FCO", date: "2026-12-05" }] };
    expect(setTripKind(multi, "round")).toMatchObject({ originCode: "YUL", destinationCode: "CDG", departDate: "2026-12-01" });
  });
});
