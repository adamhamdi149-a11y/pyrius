import { carSearchUrl, flightSearchUrl, hotelSearchUrl, mapSearchUrl } from "@/lib/booking";
import {
  AIRLINES,
  APARTMENT_IMAGES,
  CAR_CATALOG,
  CAR_SUPPLIERS,
  HOTEL_IMAGES,
  HUBS,
  NEIGHBORHOODS,
  airportByCode,
} from "@/lib/data/catalog";
import type { Airport, CarOffer, FlightOffer, FlightSearchParams, FlightSegment, HotelOffer } from "@/lib/types";
import { daysBetween, fromCAD, hash, haversineKm, parseDate, rng } from "@/lib/utils";
import type { TravelProviders } from "./types";

/**
 * Deterministic demonstration provider. Same search → same offers, every time.
 * Prices are plausible estimates for UI testing only and are always tagged source: "demo".
 */

const PROVIDER = "Pyrius demo data";

const GLOBAL_HUBS = ["YYZ", "YVR", "JFK", "ORD", "LAX", "SFO", "MIA", "BOS", "LHR", "CDG", "MAD", "LIS", "KEF", "DXB", "HND"];

// Rough relative cost of a night in each city (1 = average).
const CITY_COST: Record<string, number> = {
  JFK: 1.55, LHR: 1.45, CDG: 1.4, SFO: 1.45, VCE: 1.4, JTR: 1.35, MLE: 2.2, DXB: 1.2, HNL: 1.5, SYD: 1.25,
  KEF: 1.35, HND: 1.1, KIX: 1.0, FCO: 1.2, BCN: 1.1, MAD: 0.95, LIS: 0.9, MIA: 1.3, LAX: 1.3,
  CUN: 0.95, PUJ: 0.9, MBJ: 0.95, SJO: 0.75, GIG: 0.8, DPS: 0.65,
};

function seasonFactor(dateStr: string, dest?: Airport) {
  const m = parseDate(dateStr).getMonth();
  let f = 1;
  if (m === 6 || m === 7 || m === 11) f += 0.16;
  if (dest?.warm && (m === 1 || m === 2)) f += 0.12; // winter-sun demand
  if (m === 0 || m === 8 || m === 9) f -= 0.07;
  return f;
}

function airlinesFor(o: Airport, d: Airport) {
  const codes = Object.entries(AIRLINES)
    .filter(([, a]) => a.regions.includes(d.region) || (d.region === "na" && a.regions.includes(o.region)))
    .map(([c]) => c);
  return codes.length ? codes : ["AC"];
}

function toLocalISO(base: string, minutes: number) {
  const d = parseDate(base);
  d.setMinutes(minutes);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function buildSegment(
  r: ReturnType<typeof rng>,
  from: Airport,
  to: Airport,
  date: string,
  stops: number,
  airline: string,
): FlightSegment {
  const dist = haversineKm(from.lat, from.lon, to.lat, to.lon);
  // Only connect through hubs that sit roughly on the way (small detour).
  const candidates = [...new Set([...HUBS[to.region], ...HUBS[from.region], ...GLOBAL_HUBS])]
    .filter((h) => h !== from.code && h !== to.code)
    .map((code) => {
      const h = airportByCode(code)!;
      const detour = (haversineKm(from.lat, from.lon, h.lat, h.lon) + haversineKm(h.lat, h.lon, to.lat, to.lon)) / Math.max(dist, 1);
      return { code, detour, fromStart: haversineKm(from.lat, from.lon, h.lat, h.lon) };
    })
    .sort((a, b) => a.detour - b.detour);
  const pool = candidates.filter((c) => c.detour < 1.22);
  const usable = pool.length >= stops ? pool : candidates.slice(0, Math.max(stops, 2));
  const picked: typeof candidates = [];
  while (picked.length < stops && picked.length < usable.length) {
    const c = r.pick(usable);
    if (!picked.includes(c)) picked.push(c);
  }
  const stopCodes = picked.sort((a, b) => a.fromStart - b.fromStart).map((c) => c.code);
  const flown = picked.length ? picked.reduce((km, c, i, arr) => km + (i === 0 ? c.fromStart : haversineKm(airportByCode(arr[i - 1].code)!.lat, airportByCode(arr[i - 1].code)!.lon, airportByCode(c.code)!.lat, airportByCode(c.code)!.lon)), 0) + haversineKm(airportByCode(picked.at(-1)!.code)!.lat, airportByCode(picked.at(-1)!.code)!.lon, to.lat, to.lon) : dist;
  const air = Math.round((flown / 830) * 60 + 32 + picked.length * 25);
  const layovers = Array.from({ length: picked.length }, () => r.int(12, 40) * 5);
  const durationMin = air + layovers.reduce((a, b) => a + b, 0);
  const departMin = r.int(72, 270) * 5; // 06:00–22:30
  const arriveMin = departMin + durationMin + (to.tz - from.tz) * 60;
  return {
    from: from.code,
    to: to.code,
    depart: toLocalISO(date, departMin),
    arrive: toLocalISO(date, arriveMin),
    durationMin,
    stops: stopCodes.length,
    stopCodes,
    flightNumber: `${airline} ${r.int(100, 1999)}`,
  };
}

export function demoFlights(p: FlightSearchParams): FlightOffer[] {
  const o = airportByCode(p.originCode);
  const d = airportByCode(p.destinationCode);
  if (!o || !d || o.code === d.code) return [];
  const key = `${p.originCode}-${p.destinationCode}-${p.departDate}-${p.returnDate ?? "ow"}-${p.adults}-${p.children}`;
  const r = rng(key);
  const dist = haversineKm(o.lat, o.lon, d.lat, d.lon);
  // Deterministic shuffle so each search shows a varied set of carriers.
  const carriers = airlinesFor(o, d).sort((a, b) => hash(key + a) - hash(key + b));
  const longHaul = dist > 7800;
  const offers: FlightOffer[] = [];
  const travelers = p.adults + p.children;

  for (let i = 0; i < 16; i++) {
    const ar = rng(`${key}#${i}`);
    const code = carriers[i % carriers.length];
    const airline = AIRLINES[code];
    const roll = ar.next();
    let stops = longHaul ? (roll < 0.22 ? 0 : roll < 0.85 ? 1 : 2) : roll < 0.45 ? 0 : roll < 0.9 ? 1 : 2;
    if (dist < 1200) stops = Math.min(stops, 1);
    const outbound = buildSegment(ar, o, d, p.departDate, stops, code);
    const inbound = p.returnDate ? buildSegment(ar, d, o, p.returnDate, stops, code) : undefined;
    const lowCost = ["TS", "PD", "WS"].includes(code);
    const premium = ar.chance(0.08);

    let perAdult = 95 + dist * 0.083;
    perAdult *= stops === 0 ? 1.18 : stops === 1 ? 1 : 0.88;
    perAdult *= lowCost ? 0.86 : 0.94 + (hash(code) % 20) / 100;
    perAdult *= seasonFactor(p.departDate, d);
    perAdult *= 0.88 + ar.next() * 0.26;
    perAdult *= p.returnDate ? 1 : 0.62;
    if (premium) perAdult *= 1.65;
    const totalCAD = Math.round(perAdult * p.adults + perAdult * 0.78 * p.children);
    const total = fromCAD(totalCAD, p.currency);

    offers.push({
      id: `fl_${hash(`${key}#${i}`).toString(36)}`,
      source: "demo",
      provider: PROVIDER,
      airline: { code, name: airline.name, color: airline.color },
      outbound,
      inbound,
      cabin: premium ? "Premium Economy" : "Economy",
      baggage: { carryOn: !(lowCost && ar.chance(0.35)), checked: premium ? 2 : lowCost ? 0 : dist > 4000 ? 1 : ar.chance(0.4) ? 1 : 0 },
      totalPrice: total,
      pricePerTraveler: Math.round(total / travelers),
      currency: p.currency,
      travelers,
      searchUrl: flightSearchUrl(o.code, d.code, p.departDate, p.returnDate, p.adults, p.children),
    });
  }

  // Remove near-duplicates (same airline & departure minute).
  const seen = new Set<string>();
  return offers
    .filter((f) => {
      const k = `${f.airline.code}${f.outbound.depart}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .filter((f) => !p.nonstopOnly || f.outbound.stops === 0)
    .sort((a, b) => a.totalPrice - b.totalPrice);
}

const HOTEL_WORDS = ["Atelier", "Linden", "Solace", "Cypress", "Harbor", "Juniper", "Alder", "Lumen", "Saltwater", "Kiln", "Marlowe", "Wren", "Halcyon", "Olive", "Ember", "Tamarind"];
const AMENITIES = ["Free Wi-Fi", "Pool", "Gym", "Spa", "Restaurant", "Rooftop bar", "Air conditioning", "Kitchen", "Washer", "Airport shuttle", "Beach access", "Workspace"];

function hotelName(r: ReturnType<typeof rng>, nb: string, type: HotelOffer["type"], country: string) {
  const w = r.pick(HOTEL_WORDS);
  if (type === "Apartment") return r.pick([`${nb} ${w} Residences`, `The ${w} Flats · ${nb}`, `${w} Loft ${nb}`]);
  if (type === "Resort") return r.pick([`${w} Bay Resort`, `The ${w} ${nb} Resort`]);
  const lang = country === "France" ? "Maison" : ["Spain", "Portugal", "Mexico", "Brazil", "Costa Rica", "Dominican Republic"].includes(country) ? "Casa" : country === "Italy" ? "Palazzo" : "";
  return lang && r.chance(0.5) ? `${lang} ${w}` : r.pick([`The ${w} ${nb}`, `${nb} ${w} Hotel`, `Hotel ${w}`]);
}

export function demoHotels(p: { destinationCode: string; checkIn: string; checkOut: string; guests: number; rooms: number; currency: FlightOffer["currency"]; stayType?: "hotel" | "apartment" }): HotelOffer[] {
  const d = airportByCode(p.destinationCode);
  if (!d) return [];
  const key = `${p.destinationCode}-${p.checkIn}-${p.checkOut}-${p.guests}-${p.rooms}-${p.stayType ?? "any"}`;
  const nights = daysBetween(p.checkIn, p.checkOut);
  const hoods = NEIGHBORHOODS[d.code] ?? ["City Centre", "Old Town", "Waterfront", "Arts District", "Riverside"];
  const cost = CITY_COST[d.code] ?? 1;
  const apartments = p.stayType === "apartment";

  return Array.from({ length: 12 }, (_, i) => {
    const r = rng(`${key}#${i}`);
    const type: HotelOffer["type"] = apartments
      ? r.chance(0.75) ? "Apartment" : "Guesthouse"
      : d.warm && r.chance(0.3) ? "Resort" : r.pick(["Hotel", "Hotel", "Boutique hotel", "Boutique hotel", "Guesthouse"] as const);
    const nb = r.pick(hoods);
    const stars = type === "Guesthouse" ? r.int(2, 3) : type === "Apartment" ? 0 : r.int(3, 5);
    const perNightCAD = Math.round((85 + (stars || 3.4) * 38) * cost * (0.82 + r.next() * 0.4) * Math.max(1, p.rooms) * seasonFactor(p.checkIn, d) * (type === "Resort" ? 1.45 : 1));
    const pricePerNight = fromCAD(perNightCAD, p.currency);
    const amenities = [...AMENITIES].sort(() => r.next() - 0.5).slice(0, r.int(3, 5));
    if (type === "Apartment" && !amenities.includes("Kitchen")) amenities[0] = "Kitchen";
    const distanceKm = Math.round((type === "Resort" ? 6 + r.next() * 18 : 0.3 + r.next() * 4.5) * 10) / 10;
    const imgs = type === "Apartment" ? APARTMENT_IMAGES : HOTEL_IMAGES;
    const name = hotelName(r, nb, type, d.country);
    return {
      id: `ho_${hash(`${key}#${i}`).toString(36)}`,
      source: "demo",
      provider: PROVIDER,
      name,
      type,
      neighborhood: nb,
      city: d.city,
      distanceKm,
      stars,
      rating: Math.round((7.1 + r.next() * 2.3) * 10) / 10,
      description: `${type} in ${nb}, ${distanceKm} km from central ${d.city}. ${amenities.slice(0, 3).join(", ")}.`,
      amenities,
      image: imgs[(hash(key) + i) % imgs.length],
      pricePerNight,
      totalPrice: pricePerNight * nights,
      nights,
      checkIn: p.checkIn,
      checkOut: p.checkOut,
      guests: p.guests,
      currency: p.currency,
      freeCancellation: r.chance(0.55),
      breakfastIncluded: type !== "Apartment" && r.chance(0.4),
      searchUrl: hotelSearchUrl(d.code, p.checkIn, p.checkOut, p.guests, p.rooms),
    } satisfies HotelOffer;
  }).sort((a, b) => a.pricePerNight - b.pricePerNight);
}

export function demoCars(p: { destinationCode: string; pickUp: string; dropOff: string; currency: FlightOffer["currency"] }): CarOffer[] {
  const d = airportByCode(p.destinationCode);
  if (!d) return [];
  const key = `${p.destinationCode}-${p.pickUp}-${p.dropOff}`;
  const days = daysBetween(p.pickUp, p.dropOff);
  const cost = Math.sqrt(CITY_COST[d.code] ?? 1);
  return CAR_CATALOG.flatMap((c, ci) => {
    const r = rng(`${key}#${ci}`);
    const suppliers = [...CAR_SUPPLIERS].sort(() => r.next() - 0.5).slice(0, ci % 2 === 0 ? 2 : 1);
    return suppliers.map((supplier, si) => {
      const perDay = c.base * cost * (0.9 + r.next() * 0.25) * (si ? 1.07 : 1);
      const totalCAD = Math.round(perDay * days + 18 + r.int(0, 6) * 5);
      const conditions = [
        r.chance(0.7) ? "Unlimited mileage" : `${r.int(2, 3) * 100} km/day included`,
        r.chance(0.6) ? "Free cancellation up to 48h before pick-up" : "Non-refundable rate",
        "Credit card in driver's name required",
        "Full-to-full fuel policy",
      ];
      return {
        id: `car_${hash(`${key}#${ci}-${si}`).toString(36)}`,
        source: "demo",
        provider: PROVIDER,
        category: c.category,
        example: c.example,
        image: c.image,
        supplier,
        seats: c.seats,
        bags: c.bags,
        transmission: d.region === "eu" && c.category === "Economy" ? "Manual" : "Automatic",
        pickupLocation: `${d.city} airport (${d.code})`,
        dropoffLocation: `${d.city} airport (${d.code})`,
        pickUp: p.pickUp,
        dropOff: p.dropOff,
        days,
        totalPrice: fromCAD(totalCAD, p.currency),
        currency: p.currency,
        conditions,
        searchUrl: carSearchUrl(d.code, p.pickUp, p.dropOff),
      } satisfies CarOffer;
    });
  }).sort((a, b) => a.totalPrice - b.totalPrice);
}

export const demoProviders: TravelProviders = {
  flights: { id: "demo", source: "demo", search: async (p) => demoFlights(p) },
  hotels: { id: "demo", source: "demo", search: async (p) => demoHotels(p) },
  businesses: {
    id: "demo",
    source: "demo",
    // No business directory in demo mode, so we return none rather than invent any.
    search: async (code, category) => {
      const city = airportByCode(code)?.city ?? code;
      return { source: "demo", businesses: [], mapSearchUrl: mapSearchUrl(`${category} near ${city}`), city, category };
    },
  },
};
