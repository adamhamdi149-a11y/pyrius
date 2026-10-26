import { describe, expect, it } from "vitest";
import { countryNamed, findAirport, isAirportCode, nearestAirports, searchAirports } from "./world";

const codes = (q: string, n = 5) => searchAirports(q, n).map((a) => a.code);

describe("airport search", () => {
  it("finds airports by IATA code, city and airport name", () => {
    expect(codes("dxb")[0]).toBe("DXB");
    expect(codes("Montreal")[0]).toBe("YUL");
    expect(codes("montréal")[0]).toBe("YUL");
    expect(codes("heathrow")).toContain("LHR");
    expect(codes("charles de gaulle")[0]).toBe("CDG");
  });

  it("lists every main airport of a city with several", () => {
    const tokyo = codes("Tokyo", 4);
    expect(tokyo).toContain("HND");
    expect(tokyo).toContain("NRT");
  });

  it("treats a country as a list of its airports, not one airport", () => {
    expect(countryNamed("japan")).toBe("Japan");
    expect(countryNamed("Paris")).toBeNull();
    const japan = searchAirports("Japan", 6);
    expect(japan.length).toBeGreaterThan(3);
    expect(japan.every((a) => a.country === "Japan")).toBe(true);
  });

  it("only returns real airports", () => {
    expect(searchAirports("zzqx")).toEqual([]);
    expect(isAirportCode("XXX")).toBe(false);
    expect(isAirportCode("TUN")).toBe(true);
    expect(findAirport("dxb")?.name).toMatch(/Dubai/);
  });

  it("finds the nearest airports to a location", () => {
    expect(nearestAirports(45.5, -73.57, 3).map((x) => x.a.code)).toContain("YUL");
  });
});

describe("ranking", () => {
  it("puts a city's main airport first", () => {
    expect(codes("Dubai")[0]).toBe("DXB");
    expect(codes("Tokyo")[0]).toBe("HND");
    expect(codes("Paris")[0]).toBe("CDG");
    expect(codes("London")[0]).toBe("LHR");
  });
});

describe("countries", () => {

  it("lists a country's hubs first", () => {

    expect(codes("Japan", 4)).toEqual(expect.arrayContaining(["HND", "NRT", "KIX"]));

  });

});
