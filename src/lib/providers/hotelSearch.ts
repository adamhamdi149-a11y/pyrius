import type { HotelSearchParams, HotelSnapshot } from "@/lib/types";
import { flightMode, getProviders } from "./index";

/**
 * One place that runs hotel searches for the AI and the results cards. Identical searches within a
 * few minutes share one provider call (live searches cost quota), like flight searches do.
 */

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; snap: Promise<HotelSnapshot> }>();
const SNAPSHOT_LIMIT = 24;

const keyOf = (p: HotelSearchParams) => JSON.stringify([p.destinationCode, p.checkIn, p.checkOut, p.guests, p.currency, p.stayType ?? "hotel"]);

export async function searchHotels(p: HotelSearchParams): Promise<HotelSnapshot> {
  const key = `${flightMode()}:${keyOf(p)}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.snap;

  const provider = getProviders().hotels;
  const snap = provider.search(p).then((offers) => ({
    offers: offers.slice(0, SNAPSHOT_LIMIT),
    source: provider.source,
    provider: offers[0]?.provider ?? (provider.source === "demo" ? "Pyrius demo data" : "Google Hotels"),
    fetchedAt: new Date().toISOString(),
  }));
  cache.set(key, { at: now, snap });
  snap.catch(() => cache.delete(key));
  if (cache.size > 300) for (const [k, v] of cache) if (now - v.at > TTL_MS) cache.delete(k);
  return snap;
}
