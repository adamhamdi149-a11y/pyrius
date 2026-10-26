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
  /** The airport's own name, e.g. "Dubai International Airport". */
  name: string;
}

let index: Map<string, WorldAirport> | null = null;

function load() {
  if (index) return index;
  const countries = new Map(COUNTRY_NAMES.split("\n").map((l) => l.split("|") as [string, string]));
  index = new Map();
  for (const row of WORLD_AIRPORT_ROWS.split("\n")) {
    const [code, city, cc, lat, lon, region, size, name] = row.split("|");
    const lo = Number(lon);
    index.set(code, { code, city, country: countries.get(cc) ?? cc, lat: Number(lat), lon: lo, tz: Math.round(lo / 15), region: region as Airport["region"], size: Number(size), name: name || `${city} airport` });
  }
  for (const a of AIRPORTS) {
    const w = index.get(a.code);
    index.set(a.code, { ...a, size: w?.size ?? 3, name: w?.name ?? `${a.city} airport` });
  }
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
const MAIN = new Set(AIRPORTS.map((a) => a.code));
/** The world's busiest passenger airports, so a city or country lists its real hubs first. */
const HUB_LIST = (
    "ATL DXB DFW LHR HND DEN IST LAX ORD DEL CDG JFK CAN AMS FRA MAD SIN PEK PKX PVG SHA ICN BKK SZX CTU CKG KMG XIY HGH LAS MCO MIA CLT PHX SEA SFO EWR IAH " +
    "BOS MSP DTW FLL PHL LGA BWI SLC SAN IAD DCA TPA AUS BNA MDW HNL DOH JED RUH DMM AUH CAI KUL CGK MNL BOM BLR HYD MAA CCU HKG TPE NRT KIX FUK CTS OKA NGO ITM " +
    "SYD MEL BNE PER AKL YYZ YVR YUL YYC MEX CUN GDL GRU GIG BSB BOG MDE LIM SCL EZE PTY SJO MUC FCO BCN LGW MAN DUB ZRH VIE CPH OSL ARN HEL BRU LIS ATH WAW PRG " +
    "BUD MXP ORY SAW AYT PMI AGP TLV JNB CPT ADD NBO LOS CMN RAK ALG TUN DSS ACC HAN SGN DAD DPS HKT CMB KTM DAC ISB KHI LHE MCT BAH KWI AMM BEY GVA NCE LYS MRS " +
    "EDI BHX STN OPO TFS LPA SVO DME LED KEF CUR SJU PUJ MBJ NAS HAV SDQ"
).split(" ");
/** Busier hubs rank higher: 6 to 9 points, by their place in the list. */
const HUB_SCORE = new Map(HUB_LIST.map((c, i) => [c, 6 + 3 * (1 - i / HUB_LIST.length)]));
const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

/** The country a query names exactly ("Japan", "united states"), so the picker can list its airports. */
export function countryNamed(query: string): string | null {
  const q = fold(query.trim());
  if (q.length < 3) return null;
  for (const a of load().values()) if (fold(a.country) === q) return a.country;
  return null;
}

/**
 * Airports matching a code, city, airport name or country, best first: exact code, then city, then
 * airport name, then country, larger airports first within each. Only real airports from the table.
 */
export function searchAirports(query: string, limit = 8): WorldAirport[] {
  const q = fold(query.trim());
  if (!q) return [];
  const qWords = q.split(/[^a-z0-9]+/).filter(Boolean);
  const scored: { a: WorldAirport; s: number }[] = [];
  for (const a of load().values()) {
    const code = a.code.toLowerCase();
    const city = fold(a.city);
    const country = fold(a.country);
    const name = words(a.name);
    let s = 0;
    if (code === q) s = 100;
    else if (city === q) s = 80;
    else if (city.startsWith(q)) s = 62;
    else if (country === q) s = 50;
    else if (city.split(/[s-]+/).some((w) => w.startsWith(q))) s = 45;
    else if (qWords.length && qWords.every((w) => name.some((n) => n.startsWith(w)))) s = 40;
    else if (q.length >= 3 && country.startsWith(q)) s = 30;
    else if (code.startsWith(q)) s = 20;
    // Busy hubs and the hand-picked main airports come first; within a city, the airport named after
    // it ("Dubai International") comes before smaller ones ("Al Maktoum").
    if (s) scored.push({ a, s: s + a.size * 4 + (s >= 60 && name.includes(city.split(/[\s-]+/)[0]) ? 2 : 0) + (MAIN.has(a.code) ? 3 : 0) + (HUB_SCORE.get(a.code) ?? 0) });
  }
  return scored.sort((x, y) => y.s - x.s || x.a.city.localeCompare(y.a.city)).slice(0, limit).map((x) => x.a);
}

/** Airports with scheduled flights closest to a point (the user's location, when they share it). */
export function nearestAirports(lat: number, lon: number, limit = 4, maxKm = 250) {
  const rad = Math.PI / 180;
  return [...load().values()]
    .filter((a) => a.size >= 2)
    .map((a) => {
      const h = Math.sin(((a.lat - lat) * rad) / 2) ** 2 + Math.cos(lat * rad) * Math.cos(a.lat * rad) * Math.sin(((a.lon - lon) * rad) / 2) ** 2;
      return { a, km: Math.round(12742 * Math.asin(Math.sqrt(h))) };
    })
    .filter((x) => x.km <= maxKm)
    .sort((x, y) => x.km - y.km)
    .slice(0, limit);
}
