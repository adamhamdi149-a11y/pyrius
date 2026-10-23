import { airportByCode } from "@/lib/data/catalog";

/**
 * Legitimate general search links built from the user's own search parameters.
 * They never claim a specific fare or room is available at the shown price.
 */

export function flightSearchUrl(o: string, d: string, depart: string, ret: string | undefined, adults: number, children: number) {
  const pax = children ? `${adults} adults ${children} children` : `${adults} adult${adults > 1 ? "s" : ""}`;
  const q = ret
    ? `Flights from ${o} to ${d} on ${depart} through ${ret} for ${pax}`
    : `One way flights from ${o} to ${d} on ${depart} for ${pax}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

export function hotelSearchUrl(destCode: string, checkIn: string, checkOut: string, guests: number, rooms: number, name?: string) {
  const city = airportByCode(destCode)?.city ?? destCode;
  const params = new URLSearchParams({
    ss: name ? `${name}, ${city}` : city,
    checkin: checkIn,
    checkout: checkOut,
    group_adults: String(guests),
    no_rooms: String(rooms),
  });
  return `https://www.booking.com/searchresults.html?${params}`;
}

export function carSearchUrl(destCode: string, pickUp: string, dropOff: string) {
  return `https://www.kayak.com/cars/${destCode}/${pickUp}/${dropOff}`;
}

export function mapSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
