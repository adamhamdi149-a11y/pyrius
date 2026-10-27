import { mapSearchUrl } from "@/lib/booking";
import { findAirport } from "@/lib/data/world";
import type { BusinessCategory, LocalBusiness, LocalBusinessResult } from "@/lib/types";
import { haversineKm } from "@/lib/utils";
import { serpApiCall } from "./serpapi";
import type { LocalBusinessProvider } from "./types";

/**
 * Real businesses from Google Maps through SerpApi (https://serpapi.com/google-maps-api):
 * car rental agencies, car dealerships, private jet charter operators and yacht charters.
 * They publish no live prices that can be read; Pyrius shows who they are, how they're rated
 * and how to reach them, and never invents a price or a partnership.
 */

const PROVIDER = "Google Maps";

interface Search {
  queries: string[];
  zoom: number;
  /** How far from the airport a business still counts as "near". */
  radiusKm: number;
  /** Google fills thin results with near matches (rental agencies for "dealership"); only these kinds of business are kept. */
  kinds: RegExp;
  not?: RegExp;
}

const SEARCHES: Record<BusinessCategory, Search> = {
  "Car rental agency": { queries: ["car rental"], zoom: 12, radiusKm: 60, kinds: /rent|rental|leasing|hire|location/i },
  "Car dealership": { queries: ["car dealer"], zoom: 11, radiusKm: 60, kinds: /dealer|dealership|car sales|auto(mobile)? (sales|broker)|concession/i, not: /rent|rental|leasing|hire/i },
  "Private jet charter": { queries: ["private jet charter"], zoom: 10, radiusKm: 150, kinds: /aircraft|aviation|aero|airline|charter|jet|flight|fbo|air taxi|helicopter|airport/i },
  // Small harbours often list boat rentals rather than yacht charters, so a second search widens the net.
  "Yacht charter": { queries: ["yacht charter", "boat rental"], zoom: 11, radiusKm: 120, kinds: /yacht|boat|sail|charter|marina|cruise|catamaran/i },
};

interface SerpPlace {
  title?: string;
  place_id?: string;
  data_cid?: string;
  type?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  open_state?: string;
  thumbnail?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  permanently_closed?: boolean;
}

const https = (url?: string) => (url && /^https?:\/\//.test(url) ? url.replace(/^http:/, "https:") : undefined);

export const serpApiPlaces: LocalBusinessProvider = {
  id: "serpapi-maps",
  source: "live",
  async search(code, category) {
    const at = findAirport(code);
    const city = at?.city ?? code;
    const s = SEARCHES[category];
    const result: LocalBusinessResult = {
      source: "live",
      provider: PROVIDER,
      fetchedAt: new Date().toISOString(),
      businesses: [],
      mapSearchUrl: mapSearchUrl(`${s.queries[0]} near ${city}${at ? `, ${at.country}` : ""}`),
      city,
      category,
    };
    if (!at) return result;

    const found = new Map<string, LocalBusiness>();
    for (const q of s.queries) {
      const body = await serpApiCall<{ local_results?: SerpPlace[] }>({ q: `${q} ${city}`, ll: `@${at.lat},${at.lon},${s.zoom}z`, type: "search", gl: "us" }, "google_maps", PROVIDER);
      for (const p of body.local_results ?? []) {
        if (!p.title || !p.place_id || p.permanently_closed || found.has(p.place_id)) continue;
        const kind = `${p.type ?? ""} ${p.title}`;
        if (!s.kinds.test(kind) || s.not?.test(kind)) continue;
        const km = p.gps_coordinates ? Math.round(haversineKm(at.lat, at.lon, p.gps_coordinates.latitude, p.gps_coordinates.longitude)) : undefined;
        found.set(p.place_id, {
          id: `gm_${p.place_id}`,
          name: p.title,
          category,
          type: p.type,
          address: p.address ?? "",
          phone: p.phone,
          website: https(p.website),
          rating: p.rating,
          reviews: p.reviews,
          hours: p.open_state,
          image: https(p.thumbnail),
          distanceKm: km,
          mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.title)}&query_place_id=${encodeURIComponent(p.place_id)}`,
          verified: true,
        });
      }
      if ([...found.values()].filter((b) => (b.distanceKm ?? Infinity) <= s.radiusKm).length >= 4) break;
    }

    const all = [...found.values()];
    const near = all.filter((b) => (b.distanceKm ?? Infinity) <= s.radiusKm);
    // Better-rated, more-reviewed and closer first.
    const score = (b: LocalBusiness) => (b.rating ?? 3.5) * Math.log10(10 + (b.reviews ?? 0)) - (b.distanceKm ?? 0) / 40;
    if (near.length) {
      result.businesses = near.sort((a, b) => score(b) - score(a)).slice(0, 12);
    } else {
      // Nothing close by: show the nearest ones and say how far they are, rather than pretend they're local.
      result.businesses = all.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)).slice(0, 6);
      result.widened = result.businesses.length > 0;
    }
    return result;
  },
};
