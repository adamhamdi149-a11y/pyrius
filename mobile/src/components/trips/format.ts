import { findAirport } from "@/lib/data/world";
import { DESTINATIONS } from "@/lib/explore/destinations";
import type { Trip, TripStatus } from "@/lib/trips/types";

type Lang = "en" | "fr";

const MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
};

const parts = (iso: string) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1, d: Number(iso.slice(8, 10)) });

/** "May 10 – 20, 2027", "May 28 – Jun 3, 2027", "10 – 20 mai 2027". */
export function dateRange(start: string | undefined, end: string | undefined, lang: Lang) {
  if (!start) return lang === "fr" ? "Dates à choisir" : "Dates not set";
  const a = parts(start);
  const b = end ? parts(end) : null;
  const M = MONTHS[lang];
  if (lang === "fr") {
    if (!b) return `${a.d} ${M[a.m]} ${a.y}`;
    if (a.y !== b.y) return `${a.d} ${M[a.m]} ${a.y} – ${b.d} ${M[b.m]} ${b.y}`;
    return a.m === b.m ? `${a.d} – ${b.d} ${M[a.m]} ${a.y}` : `${a.d} ${M[a.m]} – ${b.d} ${M[b.m]} ${a.y}`;
  }
  if (!b) return `${M[a.m]} ${a.d}, ${a.y}`;
  if (a.y !== b.y) return `${M[a.m]} ${a.d}, ${a.y} – ${M[b.m]} ${b.d}, ${b.y}`;
  return a.m === b.m ? `${M[a.m]} ${a.d} – ${b.d}, ${a.y}` : `${M[a.m]} ${a.d} – ${M[b.m]} ${b.d}, ${a.y}`;
}

/** "Mon, May 10 · 21:40" from a local ISO date-time. */
export function dateTime(iso: string, lang: Lang) {
  const { m, d } = parts(iso);
  const time = iso.length > 10 ? iso.slice(11, 16) : "";
  const date = lang === "fr" ? `${d} ${MONTHS.fr[m]}` : `${MONTHS.en[m]} ${d}`;
  return time ? `${date} · ${time}` : date;
}

export const STATUS_LABEL: Record<TripStatus, { en: string; fr: string }> = {
  planning: { en: "Planning", fr: "En préparation" },
  booked: { en: "Booked", fr: "Réservé" },
  upcoming: { en: "Upcoming", fr: "À venir" },
  ongoing: { en: "In progress", fr: "En cours" },
  completed: { en: "Completed", fr: "Terminé" },
  cancelled: { en: "Cancelled", fr: "Annulé" },
};

/** The Wikipedia article for a trip's photo: an Explore destination's chosen photo, else the city's own article. */
export function tripPhoto(t: Pick<Trip, "destination" | "destinationCode">) {
  const known = t.destinationCode ? DESTINATIONS.find((d) => d.airport === t.destinationCode) : undefined;
  if (known) return known.photo;
  return findAirport(t.destinationCode)?.city ?? t.destination;
}
