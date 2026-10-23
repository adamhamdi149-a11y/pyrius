import { PLACE_ALIASES } from "@/lib/data/catalog";
import type { AwaitField, TripPreferences } from "@/lib/types";
import { addDays, parseDate, toISODate } from "@/lib/utils";

/** Fields the demo parser (or a validated LLM extraction) can fill. */
export interface Extracted {
  originCode?: string;
  destinationCode?: string;
  departDate?: string;
  returnDate?: string;
  durationDays?: number;
  flexibleDates?: boolean;
  adults?: number;
  children?: number;
  budget?: number;
  nonstopOnly?: boolean;
  carryOnOnly?: boolean;
  priority?: "cheapest" | "fastest" | "balanced";
  wantsWarm?: boolean;
  rooms?: number;
  stayBudgetPerNight?: number;
  noPreference?: boolean;
  /** Month-only answers ("in February") – dates are approximate. */
  approxDate?: boolean;
}

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14,
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, huit: 8, neuf: 9, dix: 10, douze: 12, quatorze: 14,
  a: 1, an: 1,
};
const NUMW = Object.keys(NUM).filter((k) => k.length > 2).join("|");
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUM[s]);

const MONTHS: string[][] = [
  ["january", "jan", "janvier", "janv"],
  ["february", "feb", "fevrier", "fev"],
  ["march", "mars"],
  ["april", "apr", "avril", "avr"],
  ["may", "mai"],
  ["june", "jun", "juin"],
  ["july", "jul", "juillet", "juil"],
  ["august", "aug", "aout"],
  ["september", "sept", "sep", "septembre"],
  ["october", "oct", "octobre"],
  ["november", "nov", "novembre"],
  ["december", "dec", "decembre"],
];
const MONTH_RE = MONTHS.flat().sort((a, b) => b.length - a.length).join("|");
const monthIndex = (w: string) => MONTHS.findIndex((m) => m.includes(w));

function futureDate(month: number, day: number, today: Date) {
  let d = new Date(today.getFullYear(), month, day);
  if (d.getTime() <= today.getTime()) d = new Date(today.getFullYear() + 1, month, day);
  return toISODate(d);
}

function extractDates(t: string, today: Date): { dates: string[]; approx: boolean; duration?: number } {
  const found: { pos: number; date: string }[] = [];
  let approx = false;
  for (const m of t.matchAll(/\b(20\d\d)-(\d{2})-(\d{2})\b/g)) found.push({ pos: m.index!, date: m[0] });
  // Same-month ranges: "March 10 to 20", "10-20 March", "du 10 au 20 mars".
  const sep = "\\s*(?:to|-|–|until|till|through|au|a|jusqu'?au)\\s*";
  const r1 = new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?${sep}(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?:${MONTH_RE}))`).exec(t);
  const r2 = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th|er)?${sep}(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})\\b`).exec(t);
  if (r1 || r2) {
    const [mo, a, b] = r1 ? [monthIndex(r1[1]), Number(r1[2]), Number(r1[3])] : [monthIndex(r2![3]), Number(r2![1]), Number(r2![2])];
    if (b > a && b <= 31) {
      const start = futureDate(mo, a, today);
      const y = Number(start.slice(0, 4));
      return { dates: [start, toISODate(new Date(y, mo, b))], approx: false };
    }
  }
  const dm = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th|er)?\\s+(?:of\\s+)?(${MONTH_RE})\\b`, "g");
  const md = new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "g");
  for (const m of t.matchAll(dm)) found.push({ pos: m.index!, date: futureDate(monthIndex(m[2]), Number(m[1]), today) });
  for (const m of t.matchAll(md)) {
    if (found.some((f) => Math.abs(f.pos - m.index!) < 4)) continue;
    found.push({ pos: m.index!, date: futureDate(monthIndex(m[1]), Number(m[2]), today) });
  }
  if (!found.length) {
    const mo = new RegExp(`\\b(early|late|mid|end of|beginning of|debut|fin|mi)?[\\s-]*(${MONTH_RE})\\b`).exec(t);
    // "may" is too ambiguous on its own; only accept it with a cue word.
    if (mo && !(mo[2] === "may" && !/\b(in|early|late|mid|during|this|next|of) may\b/.test(t))) {
      const day = /early|beginning|debut/.test(mo[1] ?? "") ? 5 : /late|end|fin/.test(mo[1] ?? "") ? 22 : /mid|mi/.test(mo[1] ?? "") ? 15 : 12;
      found.push({ pos: mo.index, date: futureDate(monthIndex(mo[2]), day, today) });
      approx = true;
    }
  }
  const iso = toISODate(today);
  let duration: number | undefined;
  if (!found.length) {
    if (/\b(this|next) (long )?weekend\b|\bce (long )?week-?end\b|\bweek-?end prochain\b/.test(t)) {
      const dow = today.getDay();
      const toFri = ((5 - dow + 7) % 7 || 7) + (/next weekend|week-?end prochain/.test(t) && dow < 5 ? 7 : 0);
      found.push({ pos: 0, date: addDays(iso, toFri) });
      duration = /long/.test(t) ? 3 : 2;
    } else if (/\bnext week\b|\bsemaine prochaine\b/.test(t)) {
      found.push({ pos: 0, date: addDays(iso, 7 + ((8 - today.getDay()) % 7)) });
      approx = true;
    } else if (/\bnext month\b|\bmois prochain\b/.test(t)) {
      found.push({ pos: 0, date: toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 12)) });
      approx = true;
    } else if (/\btomorrow\b|\bdemain\b/.test(t)) {
      found.push({ pos: 0, date: addDays(iso, 1) });
    } else {
      const inW = new RegExp(`\\bin (\\d+|${NUMW}) weeks?\\b|\\bdans (\\d+|${NUMW}) semaines?\\b`).exec(t);
      if (inW) {
        found.push({ pos: 0, date: addDays(iso, 7 * toNum(inW[1] ?? inW[2])) });
        approx = true;
      }
    }
  }
  return { dates: found.sort((a, b) => a.pos - b.pos).map((f) => f.date), approx, duration };
}

function extractDuration(t: string): number | undefined {
  const m = new RegExp(`\\b(\\d+|${NUMW})\\s*(days?|nights?|jours?|nuits?|weeks?|semaines?)\\b`).exec(t);
  if (m) {
    const n = toNum(m[1]);
    if (n) return /week|semaine/.test(m[2]) ? n * 7 : n;
  }
  if (/\ba week\b|\bune semaine\b/.test(t)) return 7;
  if (/\ba month\b|\bun mois\b/.test(t)) return 28;
  if (/\blong week-?end\b/.test(t)) return 3;
  if (/\bweek-?end\b/.test(t)) return 2;
  return undefined;
}

function extractPlaces(t: string, prefs: TripPreferences, awaiting?: AwaitField) {
  const hits: { pos: number; end: number; code: string }[] = [];
  const aliases = Object.keys(PLACE_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    const re = new RegExp(`(^|[^a-z])${norm(alias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z])`, "g");
    for (const m of t.matchAll(re)) {
      const pos = m.index! + m[1].length;
      const end = pos + alias.length;
      if (!hits.some((h) => pos < h.end && end > h.pos)) hits.push({ pos, end, code: PLACE_ALIASES[alias] });
    }
  }
  hits.sort((a, b) => a.pos - b.pos);
  let origin: string | undefined;
  let dest: string | undefined;
  const loose: string[] = [];
  for (const h of hits) {
    const before = t.slice(Math.max(0, h.pos - 16), h.pos);
    if (/(from|leaving|departing|out of|depuis|partant de|au depart de|de|du)\s+$/.test(before)) origin ??= h.code;
    else if (/(to|into|visit|visiting|in|a|vers|pour|en|au|aux|see|explore)\s+$/.test(before)) dest ??= h.code;
    else loose.push(h.code);
  }
  for (const code of loose) {
    if (awaiting === "origin" && !origin) origin = code;
    else if ((awaiting === "destination" || awaiting === "warm-pick") && !dest) dest = code;
    else if (!dest && !prefs.destinationCode && (prefs.originCode || origin)) dest = code;
    else if (!origin && !prefs.originCode) origin = code;
    else if (!dest) dest = code;
  }
  return { origin, dest };
}

function extractMoney(t: string): number | undefined {
  const explicit =
    /(?:\$|\bcad|\busd|€)\s?(\d[\d,]*)(\s?k)?\b/.exec(t) ??
    /\b(\d[\d,]*)(\s?k)?\s?(?:\$|dollars?\b|cad\b|usd\b|bucks\b|eur\b|euros?\b|€)/.exec(t);
  const cue =
    /\b(?:under|less than|below|max(?:imum)?|up to|budget(?: of| is)?|around|about|moins de|jusqu'?a|sous|environ)\s+(\d[\d,]*)(\s?k)?\b(?!\s*(?:days?|nights?|weeks?|jours?|nuits?|semaines?|stops?|hours?|h\b))/.exec(t);
  const m = explicit ?? cue;
  if (!m) return undefined;
  const value = Math.round(Number(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1));
  if (!Number.isFinite(value) || (!explicit && value < 50)) return undefined;
  return value;
}

export function parseMessage(raw: string, prefs: TripPreferences, awaiting?: AwaitField, today = new Date()): Extracted {
  const t = norm(raw);
  const e: Extracted = {};

  const { origin, dest } = extractPlaces(t, prefs, awaiting);
  if (origin) e.originCode = origin;
  if (dest) e.destinationCode = dest;
  if (/\b(warm|sun|sunny|beach|tropical|hot|heat|chaud|soleil|plage|tropique)/.test(t)) e.wantsWarm = true;

  const { dates, approx, duration: relDuration } = extractDates(t, today);
  if (dates.length >= 2 && dates[1] > dates[0]) {
    e.departDate = dates[0];
    e.returnDate = dates[1];
  } else if (dates.length) {
    if (prefs.departDate && !prefs.returnDate && awaiting === "duration" && dates[0] > prefs.departDate) e.returnDate = dates[0];
    else e.departDate = dates[0];
  }
  if (approx) e.approxDate = true;
  if (/flexib|whenever|any ?time|n'importe quand/.test(t)) e.flexibleDates = true;

  const dur = extractDuration(t) ?? relDuration;
  if (dur) e.durationDays = Math.min(dur, 90);

  // Travelers
  const kids = new RegExp(`\\b(\\d+|${NUMW})\\s*(kids?|children|child|enfants?|toddlers?|teens?)\\b`).exec(t);
  if (kids) e.children = toNum(kids[1]);
  const adults = new RegExp(`\\b(\\d+|${NUMW})\\s*(adults?|adultes?|people|persons?|personnes?|travell?ers?|voyageurs?|of us|pax|guests?|passengers?|passagers?)\\b`).exec(t);
  if (adults) {
    const n = toNum(adults[1]);
    e.adults = /people|persons|personnes|of us|travel|voyageur|guests|passeng/.test(adults[2]) && e.children ? Math.max(1, n - e.children) : n;
  } else if (/\b(solo|alone|just me|only me|myself|by myself|seule?|moi seule?|juste moi)\b/.test(t)) e.adults = 1;
  else if (/\b(couple|two of us|my (wife|husband|partner|girlfriend|boyfriend)|ma (femme|blonde|copine|conjointe)|mon (mari|chum|copain|conjoint))\b/.test(t)) e.adults = 2;
  else if (/\bfamily of (\d+|\w+)/.test(t)) {
    const n = toNum(/\bfamily of (\d+|\w+)/.exec(t)![1]);
    if (n) {
      e.adults = Math.min(2, n);
      e.children = Math.max(0, n - 2);
    }
  }

  // Money: per-night budgets belong to stays, everything else to flights.
  const amount = extractMoney(t);
  const perNight = /night|nuit|per day|par jour/.test(t);
  if (amount !== undefined) {
    if (perNight || awaiting === "stay-details") e.stayBudgetPerNight = amount;
    else e.budget = amount;
  }
  if (/no (fixed )?budget|no limit|budget is flexible|flexible budget|doesn'?t matter|pas de budget|peu importe|aucun budget/.test(t)) {
    if (awaiting === "stay-details") e.stayBudgetPerNight = 0;
    else e.budget = 0;
  }

  const rooms = new RegExp(`\\b(\\d+|${NUMW})\\s*(rooms?|chambres?)\\b`).exec(t);
  if (rooms) e.rooms = toNum(rooms[1]);

  // Bare-number answers
  const bare = new RegExp(`^\\s*(\\d+|${NUMW})\\s*[.!]?\\s*$`).exec(t);
  if (bare) {
    const n = toNum(bare[1]);
    if (awaiting === "travelers" && n <= 9) e.adults = n;
    else if (awaiting === "budget") e.budget = n;
    else if (awaiting === "duration" && n <= 90) e.durationDays = n;
    else if (awaiting === "stay-details") e.stayBudgetPerNight = n;
  }

  if (/non-?stop|\bdirect\b|sans escale/.test(t)) e.nonstopOnly = true;
  if (/carry[- ]?on|hand luggage|cabin bag|bagage a main|no checked/.test(t)) e.carryOnOnly = true;
  if (/cheapest|lowest|least expensive|moins cher|cheap\b|pas cher/.test(t)) e.priority = "cheapest";
  else if (/fastest|shortest|quickest|plus rapide|plus court/.test(t)) e.priority = "fastest";
  if (/no pref|no preference|anything works|doesn'?t matter|aucune pref|peu importe|^\s*(none|no|non|aucune?)\s*[.!]?\s*$/.test(t)) e.noPreference = true;

  return e;
}

/** Resolve a return date from a duration when only the departure is known. */
export function completeDates(p: TripPreferences): TripPreferences {
  if (p.departDate && !p.returnDate && p.durationDays) return { ...p, returnDate: addDays(p.departDate, p.durationDays) };
  if (p.departDate && p.returnDate && parseDate(p.returnDate) <= parseDate(p.departDate)) return { ...p, returnDate: undefined };
  return p;
}
