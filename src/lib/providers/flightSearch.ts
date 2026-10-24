import type { FlightSearchParams, FlightSnapshot } from "@/lib/types";
import { flightMode, getProviders } from "./index";

/**
 * One place that runs flight searches for the AI and the results cards. Identical searches
 * within a few minutes share one provider call (live searches cost money and quota), and
 * concurrent identical searches wait for the same call.
 */

const TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; snap: Promise<FlightSnapshot> }>();
const SNAPSHOT_LIMIT = 30;

const keyOf = (p: FlightSearchParams) => JSON.stringify([p.originCode, p.destinationCode, p.departDate, p.returnDate ?? "", p.adults, p.children, p.currency, Boolean(p.nonstopOnly)]);

export async function searchFlights(p: FlightSearchParams): Promise<FlightSnapshot> {
  const key = `${flightMode()}:${keyOf(p)}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.snap;

  const provider = getProviders().flights;
  const snap = provider.search(p).then((offers) => ({
    offers: [...offers].sort((a, b) => a.totalPrice - b.totalPrice).slice(0, SNAPSHOT_LIMIT),
    source: provider.source,
    provider: offers[0]?.provider ?? (provider.source === "demo" ? "Pyrius demo data" : "Google Flights"),
    fetchedAt: new Date().toISOString(),
  }));
  cache.set(key, { at: now, snap });
  // Failures aren't cached: the next attempt calls the provider again.
  snap.catch(() => cache.delete(key));
  if (cache.size > 300) for (const [k, v] of cache) if (now - v.at > TTL_MS) cache.delete(k);
  return snap;
}
