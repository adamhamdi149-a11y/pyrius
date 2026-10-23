import { addDays, toISODate } from "@/lib/utils";

/** The old-style search form, in pieces. Each trip sentence replaces some of them. */
export type FragKey = "to" | "from" | "dates" | "length" | "flex" | "pax" | "stops" | "sort" | "tabs" | "budget";

export interface Fragment {
  key: FragKey;
  /** Offset from the orb centre, desktop (vw / vh) and mobile (vw / vh). */
  x: number;
  y: number;
  mx: number;
  my: number;
  /** Parallax depth 0..1 and whether it shows on phones. */
  depth: number;
  mobile: boolean;
}

export const FRAGMENTS: Fragment[] = [
  { key: "to", x: -3, y: -29, mx: -25, my: -16, depth: 0.9, mobile: true },
  { key: "from", x: 13, y: -31, mx: 0, my: 0, depth: 0.3, mobile: false },
  { key: "dates", x: 29, y: -24, mx: 24, my: -15, depth: 0.6, mobile: true },
  { key: "stops", x: 36, y: -6, mx: 0, my: 0, depth: 1, mobile: false },
  { key: "flex", x: 25, y: 10, mx: 25, my: 4, depth: 0.8, mobile: true },
  { key: "budget", x: 27, y: 27, mx: 22, my: 18, depth: 0.4, mobile: true },
  { key: "tabs", x: 1, y: 31, mx: 0, my: 0, depth: 0.55, mobile: false },
  { key: "pax", x: -19, y: 21, mx: -20, my: 17, depth: 0.7, mobile: true },
  { key: "length", x: -27, y: 8, mx: -27, my: 2, depth: 0.5, mobile: true },
  { key: "sort", x: -34, y: 24, mx: 0, my: 0, depth: 0.35, mobile: false },
];

export type Turn = { role: "user" | "ai"; text: string; chips?: string[] };

export interface TripScript {
  id: "japan" | "warm" | "lisbon";
  chip: string;
  sentence: string;
  phrases: { text: string; frag: FragKey }[];
  convo: (d: TripDates) => Turn[];
  search: (today: Date) => { origin: string; dest: string; depart: string; ret: string; adults: number };
}

export interface TripDates {
  range: string;
}

const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
export const rangeLabel = (a: string, b: string) => `${fmt(a)} – ${fmt(b)}`;

/** The next occurrence of a month/day that is at least two weeks away. */
function nextDate(today: Date, month: number, day: number) {
  const d = new Date(today.getFullYear(), month, day);
  if (d.getTime() - today.getTime() < 14 * 864e5) d.setFullYear(d.getFullYear() + 1);
  return toISODate(d);
}

export const SCRIPTS: TripScript[] = [
  {
    id: "japan",
    chip: "A week in Japan this spring",
    sentence: "I want to spend a week in Japan this spring. I'm flexible on dates.",
    phrases: [
      { text: "a week", frag: "length" },
      { text: "in Japan", frag: "to" },
      { text: "this spring", frag: "dates" },
      { text: "flexible on dates", frag: "flex" },
    ],
    convo: (d) => [
      { role: "user", text: "I want to spend a week in Japan this spring. I'm flexible on dates." },
      { role: "ai", text: "Let's find options that fit your trip. What departure city should we use?", chips: ["Montréal (YUL)", "Toronto (YYZ)", "Vancouver (YVR)"] },
      { role: "user", text: "Montréal. Two of us, carry-on is fine." },
      { role: "ai", text: `Got it — Tokyo, ${d.range}, for 2 adults. Here are round-trip options you can compare.` },
    ],
    search: (today) => {
      const depart = nextDate(today, 3, 8);
      return { origin: "YUL", dest: "HND", depart, ret: addDays(depart, 7), adults: 2 };
    },
  },
  {
    id: "warm",
    chip: "Somewhere warm in February",
    sentence: "Somewhere warm in February, for the two of us, under $900.",
    phrases: [
      { text: "Somewhere warm", frag: "to" },
      { text: "in February", frag: "dates" },
      { text: "the two of us", frag: "pax" },
      { text: "under $900", frag: "budget" },
    ],
    convo: (d) => [
      { role: "user", text: "Somewhere warm in February, for the two of us, under $900." },
      { role: "ai", text: "Warm in February — Cancún, Punta Cana and Montego Bay are good places to start. Where are you leaving from?", chips: ["Montréal (YUL)", "Toronto (YYZ)"] },
      { role: "user", text: "Montréal. Let's look at Cancún for a week." },
      { role: "ai", text: `Here are round-trip options for Montréal → Cancún, ${d.range}, for 2 adults.` },
    ],
    search: (today) => {
      const depart = nextDate(today, 1, 12);
      return { origin: "YUL", dest: "CUN", depart, ret: addDays(depart, 7), adults: 2 };
    },
  },
  {
    id: "lisbon",
    chip: "Lisbon for a long weekend",
    sentence: "Lisbon for a long weekend next month, flying from Toronto.",
    phrases: [
      { text: "Lisbon", frag: "to" },
      { text: "a long weekend", frag: "length" },
      { text: "next month", frag: "dates" },
      { text: "from Toronto", frag: "from" },
    ],
    convo: (d) => [
      { role: "user", text: "Lisbon for a long weekend next month, flying from Toronto." },
      { role: "ai", text: "A long weekend in Lisbon — lovely. How many people are traveling?", chips: ["Just me", "Two adults"] },
      { role: "user", text: "Just me. Nonstop if possible." },
      { role: "ai", text: `Here are round-trip options for Toronto → Lisbon, ${d.range}, for 1 adult.` },
    ],
    search: (today) => {
      const m = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      // First Thursday of next month, back on Monday.
      while (m.getDay() !== 4) m.setDate(m.getDate() + 1);
      const depart = toISODate(m);
      return { origin: "YYZ", dest: "LIS", depart, ret: addDays(depart, 4), adults: 1 };
    },
  },
];

export const scriptById = (id: string) => SCRIPTS.find((s) => s.id === id) ?? SCRIPTS[0];
