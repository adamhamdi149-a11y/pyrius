// The small catalogue, not the world table: this module is part of every page through the store.
import { airportByCode } from "@/lib/data/catalog";
import type { AnyOffer, PricePoint, PriceTracker } from "@/lib/types";
import { formatRange } from "@/lib/utils";

/** Each tracked price is checked again this often, by the scheduled job or the "Check now" button. */
export const CHECK_EVERY_HOURS = 6;

/** A sensible default target: ~8% under the current price. */
export const suggestedTarget = (price: number) => Math.round((price * 0.92) / 5) * 5;

/** Describe an offer as a tracker. Its history starts with the one real price we have: the price when it was saved. */
export function trackerFromOffer(o: AnyOffer, targetPrice: number, now = new Date()): PriceTracker {
  const at = now.toISOString();
  const price = o.offer.totalPrice;
  const seenAt = (o.kind === "flight" || o.kind === "hotel" ? o.offer.fetchedAt : undefined) || at;
  const base = {
    id: `tr_${o.offer.id}`,
    offerId: o.offer.id,
    kind: o.kind,
    provider: o.offer.provider,
    currency: o.offer.currency,
    targetPrice,
    lastCheckedAt: seenAt,
    status: (price <= targetPrice ? "target-reached" : "active") as PriceTracker["status"],
    source: o.offer.source,
    createdAt: at,
    savedPrice: price,
    lastKnownPrice: price,
    history: [{ at: seenAt, price, simulated: o.offer.source !== "live" }],
  };
  if (o.kind === "flight") {
    const f = o.offer;
    const from = f.places?.from ?? airportByCode(f.outbound.from)?.city ?? f.outbound.from;
    const to = f.places?.to ?? airportByCode(f.outbound.to)?.city ?? f.outbound.to;
    const start = f.outbound.depart.slice(0, 10);
    const end = f.inbound?.depart.slice(0, 10) ?? f.booking?.params.returnDate;
    return {
      ...base,
      label: `${from} → ${to}`,
      subLabel: `${f.airline.name} · ${formatRange(start, end)} · ${f.travelers} traveler${f.travelers > 1 ? "s" : ""}`,
      travelDates: { start, end },
      travelers: f.travelers,
    };
  }
  if (o.kind === "hotel") {
    const h = o.offer;
    return {
      ...base,
      label: h.name,
      subLabel: `${h.city} · ${formatRange(h.checkIn, h.checkOut)} · ${h.nights} night${h.nights > 1 ? "s" : ""}`,
      travelDates: { start: h.checkIn, end: h.checkOut },
      travelers: h.guests,
    };
  }
  const c = o.offer;
  return { ...base, label: `${c.category} · ${c.supplier}`, subLabel: `${c.pickupLocation} · ${formatRange(c.pickUp, c.dropOff)}`, travelDates: { start: c.pickUp, end: c.dropOff }, travelers: 0 };
}

/** The result of looking the offer up again: its current price, or that it's no longer sold. */
export type CheckResult = { available: true; price: number; at: string } | { available: false; at: string };

/** Records one real price check on a tracker. Pure, so the scheduled job and the app apply it the same way. */
export function applyCheck(t: PriceTracker, r: CheckResult): PriceTracker {
  if (!r.available) return { ...t, lastCheckedAt: r.at, status: t.status === "paused" ? "paused" : "unavailable" };
  const point: PricePoint = { at: r.at, price: r.price, simulated: false };
  return {
    ...t,
    lastKnownPrice: r.price,
    lastCheckedAt: r.at,
    history: [...t.history, point].slice(-120),
    status: t.status === "paused" ? "paused" : r.price <= t.targetPrice ? "target-reached" : "active",
  };
}

/** Whether a tracker is due for its next automatic check. */
export const isDue = (t: PriceTracker, now = Date.now()) =>
  t.status !== "paused" && t.source === "live" && now - new Date(t.lastCheckedAt).getTime() >= (CHECK_EVERY_HOURS * 60 - 10) * 60_000 && !travelStarted(t, now);

/** No point checking a price once the trip has begun. */
export const travelStarted = (t: PriceTracker, now = Date.now()) => new Date(`${t.travelDates.start}T00:00:00Z`).getTime() < now - 86_400_000;
