import type { Currency } from "@/lib/types";

/** FNV-1a hash → stable 32-bit seed for any string. */
export function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: tiny deterministic PRNG so demo data is identical for identical searches. */
export function rng(seed: number | string) {
  let a = typeof seed === "string" ? hash(seed) : seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]) => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}

export const uid = (prefix = "") =>
  prefix + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---------- Dates (all travel dates are plain YYYY-MM-DD strings) ----------

export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export const daysBetween = (a: string, b: string) =>
  Math.max(1, Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000));

export function formatDate(s: string, locale = "en", opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return parseDate(s).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", opts);
}

export function formatRange(a: string, b?: string, locale = "en") {
  if (!b) return formatDate(a, locale, { weekday: "short", month: "short", day: "numeric" });
  return `${formatDate(a, locale)} – ${formatDate(b, locale)}`;
}

export function formatTime(iso: string) {
  return iso.slice(11, 16);
}

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

export function timeAgo(iso: string, locale = "en") {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diff < 60) return rtf.format(-Math.max(1, Math.round(diff)), "second");
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  return rtf.format(-Math.round(diff / 86400), "day");
}

// ---------- Money ----------

const FX: Record<Currency, number> = { CAD: 1, USD: 0.73, EUR: 0.67 };

/** Demo providers price in CAD; convert with a fixed, clearly approximate table. */
export const fromCAD = (amount: number, currency: Currency) => Math.round(amount * FX[currency]);

export function money(amount: number, currency: Currency, locale = "en") {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Exact amount with cents (used for plan prices like $9.99). */
export function moneyExact(amount: number, currency: Currency, locale = "en") {
  return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: amount % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
