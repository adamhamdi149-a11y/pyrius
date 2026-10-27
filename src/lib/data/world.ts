import type { Airport } from "@/lib/types";
import { AIRPORTS, cityName } from "./catalog";
import { COUNTRY_NAMES, WORLD_AIRPORT_ROWS } from "./worldAirports";

/**
 * Every airport with scheduled passenger service (about 4,000), so a trip can start or end anywhere
 * Google Flights flies. The hand-picked catalogue entries (images, French names, demo data) take precedence.
 * Kept apart from the catalogue so the marketing site doesn't load the whole table.
 */

export interface WorldAirport extends Airport {
  /** 3 large, 2 medium, 1 small: used to rank matches. */
  size: number;
}

let index: Map<string, WorldAirport> | null = null;

function load() {
  if (index) return index;
  const countries = new Map(COUNTRY_NAMES.split("\n").map((l) => l.split("|") as [string, string]));
  index = new Map();
  for (const row of WORLD_AIRPORT_ROWS.split("\n")) {
    const [code, city, cc, lat, lon, region, size] = row.split("|");
    const lo = Number(lon);
    index.set(code, { code, city, country: countries.get(cc) ?? cc, lat: Number(lat), lon: lo, tz: Math.round(lo / 15), region: region as Airport["region"], size: Number(size) });
  }
  for (const a of AIRPORTS) index.set(a.code, { ...a, size: index.get(a.code)?.size ?? 3 });
  return index;
}

export const findAirport = (code?: string | null): WorldAirport | undefined => (code ? load().get(code.trim().toUpperCase()) : undefined);
export const isAirportCode = (code: unknown): code is string => typeof code === "string" && /^[A-Z]{3}$/.test(code) && load().has(code);

/** City name for display, in French for the catalogue cities that have one; falls back to the code. */
export const placeName = (code: string | undefined, locale: "en" | "fr" = "en") => (code && AIRPORTS.some((a) => a.code === code) ? cityName(code, locale) : findAirport(code)?.city ?? code ?? "");

/** "Tunis, Tunisia (TUN)" */
export const airportLabel = (code: string) => {
  const a = findAirport(code);
  return a ? `${a.city}, ${a.country} (${a.code})` : code;
};

/** Other airports with scheduled flights within reach, larger and closer first ("Tunis 330 km"). */
export function nearbyAirports(code: string, maxKm = 350, limit = 3) {
  const from = findAirport(code);
  if (!from) return [];
  const rad = Math.PI / 180;
  const km = (a: Airport) => {
    const h = Math.sin(((a.lat - from.lat) * rad) / 2) ** 2 + Math.cos(from.lat * rad) * Math.cos(a.lat * rad) * Math.sin(((a.lon - from.lon) * rad) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  return [...load().values()]
    .filter((a) => a.code !== from.code && a.size >= 2)
    .map((a) => ({ a, d: km(a) }))
    .filter((x) => x.d <= maxKm)
    .sort((x, y) => y.a.size - x.a.size || x.d - y.d)
    .slice(0, limit)
    .map((x) => ({ code: x.a.code, city: x.a.city, km: Math.round(x.d / 10) * 10 }));
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Airports matching a code, city or country, best first (exact code, then city, then larger airports). */
export function searchAirports(query: string, limit = 8): WorldAirport[] {
  const q = fold(query.trim());
  if (!q) return [];
  const scored: { a: WorldAirport; s: number }[] = [];
  for (const a of load().values()) {
    const code = a.code.toLowerCase();
    const city = fold(a.city);
    const country = fold(a.country);
    let s = 0;
    if (code === q) s = 100;
    else if (city === q) s = 80;
    else if (city.startsWith(q)) s = 60;
    else if (city.split(/[\s-]+/).some((w) => w.startsWith(q))) s = 45;
    else if (q.length >= 3 && country.startsWith(q)) s = 30;
    else if (code.startsWith(q)) s = 20;
    if (s) scored.push({ a, s: s + a.size * 4 });
  }
  return scored.sort((x, y) => y.s - x.s || x.a.city.localeCompare(y.a.city)).slice(0, limit).map((x) => x.a);
}

/** The closest airport with regular scheduled service (medium or large) to a point, e.g. the user's location. */
export function nearestAirport(lat: number, lon: number): (WorldAirport & { km: number }) | undefined {
  const rad = Math.PI / 180;
  let best: WorldAirport | undefined;
  let bestKm = Infinity;
  for (const a of load().values()) {
    if (a.size < 2) continue;
    const h = Math.sin(((a.lat - lat) * rad) / 2) ** 2 + Math.cos(lat * rad) * Math.cos(a.lat * rad) * Math.sin(((a.lon - lon) * rad) / 2) ** 2;
    const km = 12742 * Math.asin(Math.sqrt(h));
    // A large airport wins over a slightly closer regional one.
    const score = km - (a.size === 3 ? 40 : 0);
    if (score < bestKm) {
      bestKm = score;
      best = a;
    }
  }
  return best ? { ...best, km: Math.round(bestKm + (best.size === 3 ? 40 : 0)) } : undefined;
}
