import { hotelSearchUrl } from "@/lib/booking";
import { findAirport } from "@/lib/data/world";
import type { HotelOffer, HotelSearchParams } from "@/lib/types";
import { daysBetween, hash } from "@/lib/utils";
import { ProviderError } from "./errors";
import { serpApiCall } from "./serpapi";
import type { HotelProvider } from "./types";

/**
 * Live hotels and vacation rentals from Google Hotels through SerpApi
 * (https://serpapi.com/google-hotels-api). Server-side only.
 *  - search: properties with tonight's lowest rate for these dates, rating, photos and amenities.
 *  - sellers(property_token): every site selling that property for these dates, each with
 *    Google's redirect to its booking page. The same lookup re-checks a tracked price.
 * Anything without a price for the dates is dropped, never guessed.
 */

const PROVIDER = "Google Hotels";

interface SerpRate {
  extracted_lowest?: number;
  extracted_before_taxes_fees?: number;
}
interface SerpProperty {
  type?: string;
  name?: string;
  description?: string;
  link?: string;
  property_token?: string;
  address?: string;
  rate_per_night?: SerpRate;
  total_rate?: SerpRate;
  extracted_hotel_class?: number;
  images?: { thumbnail?: string; original_image?: string }[];
  overall_rating?: number;
  reviews?: number;
  amenities?: string[];
  free_cancellation?: boolean;
}
interface SerpSeller {
  source?: string;
  link?: string;
  logo?: string;
  official?: boolean;
  free_cancellation?: boolean;
  rate_per_night?: SerpRate;
  total_rate?: SerpRate;
}
interface SerpHotelResponse {
  properties?: SerpProperty[];
  featured_prices?: SerpSeller[];
  prices?: SerpSeller[];
  total_rate?: SerpRate;
  link?: string;
}

/** A site selling the room, with Google's redirect to its booking page for these dates. */
export interface HotelSeller {
  name: string;
  official: boolean;
  logo?: string;
  pricePerNight?: number;
  total?: number;
  currency: string;
  freeCancellation?: boolean;
  url: string;
}

const placeQuery = (code: string) => {
  const a = findAirport(code);
  return a ? `${a.city}, ${a.country}` : code;
};

/** Google's thumbnails are 287 px wide; the same image is served larger by changing its size suffix. */
const bigger = (url?: string) => (url && /googleusercontent\.com/.test(url) ? url.replace(/=s\d+-w\d+-h\d+/, "=s900-w900-h600") : url);

function kindOf(p: SerpProperty, apartment: boolean): HotelOffer["type"] {
  const text = `${p.name ?? ""} ${p.description ?? ""}`.toLowerCase();
  if (apartment || p.type === "vacation rental") return /villa|house|maison|dar |riad/.test(text) ? "Guesthouse" : "Apartment";
  if (/resort/.test(text)) return "Resort";
  if (/guest ?house|b&b|bed and breakfast|riad|\bdar\b|hostel|inn\b/.test(text)) return "Guesthouse";
  if (/boutique/.test(text)) return "Boutique hotel";
  return "Hotel";
}

const params = (p: HotelSearchParams): Record<string, string> => ({
  q: placeQuery(p.destinationCode),
  check_in_date: p.checkIn,
  check_out_date: p.checkOut,
  adults: String(Math.max(1, p.guests)),
  currency: p.currency,
  gl: "us",
  ...(p.stayType === "apartment" ? { vacation_rentals: "true" } : {}),
});

export function toHotel(prop: SerpProperty, p: HotelSearchParams, fetchedAt: string): HotelOffer | null {
  const perNight = prop.rate_per_night?.extracted_lowest;
  if (!prop.name || !prop.property_token || typeof perNight !== "number" || perNight <= 0) return null;
  const nights = Math.max(1, daysBetween(p.checkIn, p.checkOut));
  const total = prop.total_rate?.extracted_lowest ?? perNight * nights;
  const city = findAirport(p.destinationCode)?.city ?? p.destinationCode;
  const images = (prop.images ?? []).map((i) => bigger(i.thumbnail) ?? i.original_image).filter((x): x is string => Boolean(x)).slice(0, 6);
  const amenities = (prop.amenities ?? []).slice(0, 12);
  return {
    id: `gh_${hash(`${prop.property_token}|${p.checkIn}|${p.checkOut}|${p.guests}`).toString(36)}`,
    source: "live",
    provider: PROVIDER,
    name: prop.name,
    type: kindOf(prop, p.stayType === "apartment"),
    city,
    stars: prop.extracted_hotel_class ?? 0,
    rating: typeof prop.overall_rating === "number" ? prop.overall_rating : undefined,
    ratingScale: 5,
    reviews: prop.reviews,
    description: prop.description ?? "",
    amenities,
    image: images[0] ?? "",
    images,
    address: prop.address,
    link: prop.link?.startsWith("https://") ? prop.link : undefined,
    pricePerNight: Math.round(perNight),
    totalPrice: Math.round(total),
    nights,
    checkIn: p.checkIn,
    checkOut: p.checkOut,
    guests: p.guests,
    currency: p.currency,
    freeCancellation: prop.free_cancellation,
    breakfastIncluded: amenities.some((a) => /free breakfast|breakfast included/i.test(a)) || undefined,
    propertyToken: prop.property_token,
    params: p,
    fetchedAt,
    searchUrl: hotelSearchUrl(p.destinationCode, p.checkIn, p.checkOut, p.guests, p.rooms, prop.name, city),
  };
}

/** Only Google's own redirect is accepted as a booking destination. */
const safeGoogleLink = (url?: string) => {
  try {
    const u = new URL(url ?? "");
    return u.protocol === "https:" && u.hostname === "www.google.com" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
};

export const serpApiHotels: HotelProvider & {
  sellers(propertyToken: string, p: HotelSearchParams): Promise<HotelSeller[]>;
} = {
  id: "serpapi-hotels",
  source: "live",
  async search(p) {
    const fetchedAt = new Date().toISOString();
    const body = await serpApiCall<SerpHotelResponse>(params(p), "google_hotels", PROVIDER);
    const seen = new Set<string>();
    return (body.properties ?? [])
      .map((x) => toHotel(x, p, fetchedAt))
      .filter((h): h is HotelOffer => Boolean(h) && !seen.has(h!.id) && Boolean(seen.add(h!.id)));
  },
  async sellers(propertyToken, p) {
    const body = await serpApiCall<SerpHotelResponse>({ ...params(p), property_token: propertyToken }, "google_hotels", PROVIDER);
    const best = new Map<string, HotelSeller>();
    for (const s of [...(body.featured_prices ?? []), ...(body.prices ?? [])]) {
      const url = safeGoogleLink(s.link);
      const total = s.total_rate?.extracted_lowest;
      if (!s.source || !url || typeof total !== "number") continue;
      const seller: HotelSeller = {
        name: s.source,
        official: Boolean(s.official),
        logo: s.logo,
        pricePerNight: s.rate_per_night?.extracted_lowest,
        total: Math.round(total),
        currency: p.currency,
        freeCancellation: s.free_cancellation,
        url,
      };
      const prev = best.get(s.source);
      if (!prev || (prev.total ?? Infinity) > seller.total!) best.set(s.source, seller);
    }
    const list = [...best.values()].sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity) || Number(b.official) - Number(a.official));
    if (!list.length) throw new ProviderError("expired", PROVIDER, "No sellers for these dates");
    return list;
  },
};
