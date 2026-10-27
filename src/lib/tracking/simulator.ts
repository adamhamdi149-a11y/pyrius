import type { PricePoint } from "@/lib/types";
import { rng } from "@/lib/utils";

/**
 * Sample price history for the website's illustrations only; the app records real prices.
 * Every generated point is flagged `simulated: true` and never represents a real market movement.
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

// The website illustrations use the same default target as the app.
export { suggestedTarget } from "./trackers";
