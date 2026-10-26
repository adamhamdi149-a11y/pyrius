import type { HotelOffer } from "@/lib/types";

/** What the AI sees of a stay card: facts only, in the order the cards show them. */
export interface HotelBrief {
  n: number;
  id: string;
  name: string;
  type: string;
  stars: number;
  rating: number | null;
  reviews: number | null;
  per_night: number;
  total: number;
  nights: number;
  currency: string;
  amenities: string[];
  address: string | null;
}

/** Card order: cheapest first, or for "luxury" the highest class and best rated first (well-reviewed ratings count more). */
export function sortStays(list: HotelOffer[], by: "price" | "luxury" = "price") {
  const score = (h: HotelOffer) => h.stars * 2 + (h.rating ?? 0) * Math.min(1, Math.log10(1 + (h.reviews ?? 0)) / 3);
  return [...list].sort((x, y) => (by === "luxury" ? score(y) - score(x) || y.pricePerNight - x.pricePerNight : x.pricePerNight - y.pricePerNight));
}

export function hotelBrief(h: HotelOffer, n: number): HotelBrief {
  return {
    n,
    id: h.id,
    name: h.name,
    type: h.type,
    stars: h.stars,
    rating: h.rating ?? null,
    reviews: h.reviews ?? null,
    per_night: h.pricePerNight,
    total: h.totalPrice,
    nights: h.nights,
    currency: h.currency,
    amenities: h.amenities.slice(0, 6),
    address: h.address ?? null,
  };
}
