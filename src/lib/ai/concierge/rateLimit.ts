/**
 * Per-user request limits for the AI concierge. Kept in memory, so each server instance
 * counts separately: it stops bursts and runaway clients, not a determined attacker.
 * OpenAI's own spending limit on the account is the hard ceiling.
 */

export type RateWindows = { ms: number; max: number }[];

const WINDOWS: RateWindows = [
  { ms: 60_000, max: 20 },
  { ms: 24 * 60 * 60_000, max: 300 },
];

const hits = new Map<string, number[]>();

export function allow(key: string, now = Date.now(), windows: RateWindows = WINDOWS) {
  const longest = windows[windows.length - 1].ms;
  const list = (hits.get(key) ?? []).filter((t) => now - t < longest);
  for (const w of windows) {
    if (list.filter((t) => now - t < w.ms).length >= w.max) {
      hits.set(key, list);
      return { ok: false as const, retryAfter: Math.ceil(w.ms / 1000) };
    }
  }
  list.push(now);
  hits.set(key, list);
  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < longest)) hits.delete(k);
  return { ok: true as const };
}
