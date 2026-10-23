import type { AnyOffer, PricePoint, PriceTracker } from "@/lib/types";
import { formatRange, hash, rng } from "@/lib/utils";
import { airportByCode } from "@/lib/data/catalog";

/**
 * Deterministic demo price simulator.
 * - Prices only change when a check is explicitly triggered.
 * - Every generated point is flagged `simulated: true` and the UI labels it as such.
 * - It never represents a real market movement.
 * A production PriceCheckProvider replaces `simulateCheck` server-side (see docs/price-tracking.md).
 */

const DAY = 86400000;

/** Sample history leading up to the moment the offer was saved: a gentle, plausible walk ending at the saved price. */
export function sampleHistory(offerId: string, price: number, endAt: string, points = 18): PricePoint[] {
  const r = rng(`hist:${offerId}`);
  const end = new Date(endAt).getTime();
  // Fares move in steps (fare buckets), drifting from a start level toward today's price.
  const start = price * (1 + (r.next() - 0.45) * 0.14);
  let current = start;
  const out: PricePoint[] = [];
  for (let i = points - 1; i >= 1; i--) {
    const progress = 1 - i / (points - 1);
    const anchor = start + (price - start) * progress;
    if (r.chance(0.32)) current = anchor * (1 + (r.next() - 0.5) * 0.05);
    out.push({ at: new Date(end - i * DAY).toISOString(), price: Math.round(current), simulated: true });
  }
  out.push({ at: new Date(end).toISOString(), price, simulated: true });
  return out;
}

/** Next simulated price, derived only from the offer id and how many checks happened. */
export function simulateCheck(t: PriceTracker, now = new Date()): PriceTracker {
  const n = t.history.length;
  const r = rng(hash(`${t.offerId}:${n}`));
  const last = t.lastKnownPrice;
  const reversion = (t.savedPrice - last) * 0.35;
  const shock = (r.next() - 0.52) * t.savedPrice * 0.07;
  const price = Math.max(Math.round(t.savedPrice * 0.7), Math.round(last + reversion + shock));
  const point: PricePoint = { at: now.toISOString(), price, simulated: true };
  const reached = price <= t.targetPrice;
  return {
    ...t,
    lastKnownPrice: price,
    lastCheckedAt: point.at,
    history: [...t.history, point].slice(-60),
    status: t.status === "paused" ? "paused" : reached ? "target-reached" : "active",
  };
}

/** Describe any offer as a tracker. Real providers would also fill providerOfferId. */
export function trackerFromOffer(o: AnyOffer, targetPrice: number, now = new Date()): PriceTracker {
  const at = now.toISOString();
  const base = {
    id: `tr_${o.offer.id}`,
    offerId: o.offer.id,
    kind: o.kind,
    provider: o.offer.provider,
    currency: o.offer.currency,
    targetPrice,
    lastCheckedAt: at,
    status: "active" as const,
    source: o.offer.source,
    createdAt: at,
  };
  const price = o.offer.totalPrice;
  const history = sampleHistory(o.offer.id, price, at);
  if (o.kind === "flight") {
    const f = o.offer;
    const from = airportByCode(f.outbound.from)?.city ?? f.outbound.from;
    const to = airportByCode(f.outbound.to)?.city ?? f.outbound.to;
    const start = f.outbound.depart.slice(0, 10);
    const end = f.inbound?.depart.slice(0, 10);
    return {
      ...base,
      label: `${from} → ${to}`,
      subLabel: `${f.airline.name} · ${formatRange(start, end)} · ${f.travelers} traveler${f.travelers > 1 ? "s" : ""}`,
      travelDates: { start, end },
      travelers: f.travelers,
      savedPrice: price,
      lastKnownPrice: price,
      history,
    };
  }
  if (o.kind === "hotel") {
    const h = o.offer;
    return {
      ...base,
      label: h.name,
      subLabel: `${h.neighborhood}, ${h.city} · ${formatRange(h.checkIn, h.checkOut)} · ${h.nights} night${h.nights > 1 ? "s" : ""}`,
      travelDates: { start: h.checkIn, end: h.checkOut },
      travelers: h.guests,
      savedPrice: price,
      lastKnownPrice: price,
      history,
    };
  }
  const c = o.offer;
  return {
    ...base,
    label: `${c.category} · ${c.supplier}`,
    subLabel: `${c.pickupLocation} · ${formatRange(c.pickUp, c.dropOff)}`,
    travelDates: { start: c.pickUp, end: c.dropOff },
    travelers: 0,
    savedPrice: price,
    lastKnownPrice: price,
    history,
  };
}

/** A sensible default target: ~8% under the current displayed price. */
export const suggestedTarget = (price: number) => Math.round((price * 0.92) / 5) * 5;
