import { describe, expect, it } from "vitest";
import { isAirportCode } from "@/lib/data/world";
import { DESTINATIONS } from "./destinations";
import { bestSeason, characteristics, explain, MIN_ANSWERS, personalityFor, profileFrom, recommend, SKIP, type Answers } from "./engine";
import { QUESTIONS } from "./questions";
import { POLES, TRAITS } from "./traits";

const ids = (answers: Answers) => recommend(profileFrom(answers)).map((r) => r.destination.id);

describe("Explore catalog", () => {
  it("has real airports, every trait, valid months and reasons for known poles", () => {
    const poles = new Set(Object.values(POLES).flat());
    for (const d of DESTINATIONS) {
      expect(isAirportCode(d.airport), `${d.id} airport ${d.airport}`).toBe(true);
      for (const t of TRAITS) expect(Math.abs(d.traits[t] ?? 9), `${d.id}.${t}`).toBeLessThanOrEqual(1);
      expect(d.bestMonths.every((m) => m >= 1 && m <= 12)).toBe(true);
      for (const p of Object.keys(d.reasons)) expect(poles.has(p as never), `${d.id} reason ${p}`).toBe(true);
    }
    expect(new Set(DESTINATIONS.map((d) => d.id)).size).toBe(DESTINATIONS.length);
  });

  it("has questions with two distinct options that each move a trait", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(8);
    for (const q of QUESTIONS) {
      expect(q.options[0].id).not.toBe(q.options[1].id);
      for (const o of q.options) expect(Object.keys(o.effects).length).toBeGreaterThan(0);
    }
  });
});

describe("Explore recommendations", () => {
  it("needs a few answers before recommending", () => {
    expect(recommend(profileFrom({ climate: "tropics" }))).toEqual([]);
    expect(profileFrom({ climate: "tropics", energy: SKIP }).answered).toBeLessThan(MIN_ANSWERS);
  });

  it("sends a warm, coastal, private, premium traveller to warm luxury coasts", () => {
    const top = ids({ climate: "tropics", terrain: "ocean", social: "private", style: "luxury", budget: "premium", energy: "peaceful" });
    expect(top[0]).toBe("maldives");
    expect(top.slice(0, 3).some((id) => ["santorini", "amalfi", "maui", "tulum", "dubai"].includes(id))).toBe(true);
    expect(top).not.toContain("faroe");
  });

  it("sends a snow and mountain lover to the mountains", () => {
    const top = ids({ climate: "snow", terrain: "mountain", setting: "wild", energy: "peaceful", social: "private" });
    expect(top.slice(0, 3).every((id) => ["zermatt", "banff", "dolomites", "faroe", "lofoten", "iceland", "patagonia", "queenstown"].includes(id))).toBe(true);
  });

  it("sends a lively, social city lover on a budget to big affordable cities", () => {
    const top = ids({ energy: "vibrant", setting: "city", social: "people", budget: "value", food: "street", pace: "packed" });
    expect(top.slice(0, 2).some((id) => ["bangkok", "mexicocity", "prague", "barcelona"].includes(id))).toBe(true);
    expect(top).not.toContain("maldives");
  });

  it("explains each pick with the traits that matched, and caps a region at two", () => {
    const recs = recommend(profileFrom({ climate: "tropics", era: "historic", budget: "value", style: "authentic", distance: "faraway" }));
    expect(recs.length).toBe(5);
    const regions = recs.map((r) => r.destination.region);
    for (const r of new Set(regions)) expect(regions.filter((x) => x === r).length).toBeLessThanOrEqual(2);
    for (const r of recs) {
      expect(r.because.length).toBeGreaterThan(0);
      expect(r.why.en.length).toBeGreaterThan(10);
      expect(r.match).toBeGreaterThan(50);
    }
  });

  it("is deterministic and can leave out places already seen", () => {
    const a = { climate: "tropics", terrain: "ocean", energy: "vibrant" };
    expect(ids(a)).toEqual(ids(a));
    const first = ids(a);
    const next = recommend(profileFrom(a), { exclude: first }).map((r) => r.destination.id);
    expect(next.some((id) => first.includes(id))).toBe(false);
  });
});

describe("Explore personality and labels", () => {
  it("names the personality from the strongest traits", () => {
    expect(personalityFor(profileFrom({ climate: "tropics", terrain: "ocean", distance: "faraway", energy: "vibrant" })).id).toBe("tropical-explorer");
    expect(personalityFor(profileFrom({ climate: "snow", terrain: "mountain", setting: "wild" })).id).toBe("alpine-soul");
    expect(personalityFor(profileFrom({ energy: "vibrant", social: "people", setting: "city", pace: "packed" })).id).toBe("city-spark");
    expect(characteristics(profileFrom({ climate: "tropics", terrain: "ocean", energy: "vibrant" })).map((c) => c.pole)).toContain("warm");
  });

  it("writes the best season as ranges, across the new year", () => {
    expect(bestSeason([4, 5, 6, 9, 10], "en")).toBe("Apr–Jun, Sep–Oct");
    expect(bestSeason([11, 12, 1, 2, 3, 4], "en")).toBe("Nov–Apr");
    expect(bestSeason([7], "fr")).toBe("juil.");
    expect(bestSeason([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "en")).toBe("All year");
  });

  it("falls back to the place's own line when no reason matches", () => {
    const d = DESTINATIONS[0];
    expect(explain(d, [])).toEqual(d.about);
  });
});
