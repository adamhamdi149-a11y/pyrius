import { describe, expect, it } from "vitest";
import { ageOn } from "@/lib/providers/duffel";
import type { FlightSearchParams } from "@/lib/types";
import { cleanTraveller, travellerKinds } from "./travellers";

const trip: FlightSearchParams = { originCode: "YUL", destinationCode: "CDG", departDate: "2026-12-12", returnDate: "2026-12-20", adults: 2, children: 1, infants: 1, currency: "USD" };
const adult = { title: "ms", gender: "f", givenName: "Amira", familyName: "Ben Salah", bornOn: "1990-04-02", email: "amira@example.com", phone: "+1 (514) 555-0123" };
const TODAY = "2026-11-14";

describe("ageOn", () => {
  it("counts a birthday only once it has passed", () => {
    expect(ageOn("2016-12-20", "2026-12-20")).toBe(10);
    expect(ageOn("2016-12-21", "2026-12-20")).toBe(9);
  });
});

describe("travellerKinds", () => {
  it("lists adults, then children, then lap infants, like the fare's passengers", () => {
    expect(travellerKinds(trip)).toEqual(["adult", "adult", "child", "infant"]);
  });
});

describe("cleanTraveller", () => {
  it("accepts a complete adult and normalises the phone number", () => {
    expect(cleanTraveller(adult, "adult", trip, TODAY)).toMatchObject({ kind: "adult", phone: "+15145550123", familyName: "Ben Salah" });
  });

  it("checks ages on the last day of travel", () => {
    expect(cleanTraveller({ ...adult, bornOn: "2009-01-01" }, "adult", trip, TODAY)).toMatch(/18 or older/);
    expect(cleanTraveller({ ...adult, title: "miss", bornOn: "2016-05-01" }, "child", trip, TODAY)).toMatchObject({ kind: "child" });
    expect(cleanTraveller({ ...adult, bornOn: "2024-12-21" }, "infant", trip, TODAY)).toMatchObject({ kind: "infant" });
    expect(cleanTraveller({ ...adult, bornOn: "2024-12-19" }, "infant", trip, TODAY)).toMatch(/under 2/);
  });

  it("rejects missing or malformed details", () => {
    expect(cleanTraveller({ ...adult, title: "" }, "adult", trip, TODAY)).toMatch(/title/);
    expect(cleanTraveller({ ...adult, givenName: "名前" }, "adult", trip, TODAY)).toMatch(/Latin/);
    expect(cleanTraveller({ ...adult, bornOn: "2027-01-01" }, "adult", trip, TODAY)).toMatch(/date of birth/);
    expect(cleanTraveller({ ...adult, email: "nope" }, "adult", trip, TODAY)).toMatch(/email/);
    expect(cleanTraveller({ ...adult, phone: "514 555 0123" }, "adult", trip, TODAY)).toMatch(/country code/);
  });
});
