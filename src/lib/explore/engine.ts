import { DESTINATIONS, type BudgetTier, type Destination } from "./destinations";
import { QUESTIONS, type ExploreQuestion } from "./questions";
import { POLE_LABELS, poleOf, TRAITS, type Bilingual, type Pole, type Trait, type TraitVector } from "./traits";

/**
 * Explore's recommendation engine. Answers become a travel profile (a position on each trait, plus
 * how sure we are of it); destinations are ranked by how closely they match it on the traits the
 * person actually expressed, and each pick is explained by the traits that matched. Deterministic:
 * the same answers always give the same results.
 */

export type Answers = Record<string, string>;
export type Lang = "en" | "fr";

/** An answer that skips the question. */
export const SKIP = "skip";
/** Fewer answers than this don't say enough to recommend anything. */
export const MIN_ANSWERS = 3;

export interface Profile {
  /** Average position on each trait, -1 to 1, for the traits the answers touched. */
  vector: TraitVector;
  /** How strongly each trait was expressed (0 to 1). */
  weight: TraitVector;
  answered: number;
}

export function profileFrom(answers: Answers, questions: ExploreQuestion[] = QUESTIONS): Profile {
  const sum: TraitVector = {};
  const reach: TraitVector = {};
  let answered = 0;
  for (const q of questions) {
    const pick = answers[q.id];
    const option = q.options.find((o) => o.id === pick);
    // Every question counts towards what it could have measured, so skipped ones don't inflate the rest.
    const touched = new Set(q.options.flatMap((o) => Object.keys(o.effects) as Trait[]));
    for (const t of touched) reach[t] = (reach[t] ?? 0) + Math.max(...q.options.map((o) => Math.abs(o.effects[t] ?? 0)));
    if (!option) continue;
    answered++;
    for (const [t, v] of Object.entries(option.effects) as [Trait, number][]) sum[t] = (sum[t] ?? 0) + v;
  }
  const vector: TraitVector = {};
  const weight: TraitVector = {};
  for (const t of TRAITS) {
    if (sum[t] === undefined || !reach[t]) continue;
    const v = Math.max(-1, Math.min(1, sum[t]! / reach[t]!));
    if (Math.abs(v) < 0.05) continue;
    vector[t] = v;
    weight[t] = Math.abs(v);
  }
  return { vector, weight, answered };
}

/** 0 to 1: how well a destination fits the profile, on the traits the person expressed. */
export function matchScore(p: Profile, d: Destination) {
  let num = 0;
  let den = 0;
  for (const [t, w] of Object.entries(p.weight) as [Trait, number][]) {
    const u = p.vector[t]!;
    const v = d.traits[t] ?? 0;
    num += w * (1 - Math.abs(u - v) / 2);
    den += w;
  }
  return den ? num / den : 0;
}

/** The traits where person and place agree most, strongest first. */
function agreements(p: Profile, d: Destination) {
  return (Object.entries(p.vector) as [Trait, number][])
    .map(([t, u]) => ({ t, u, v: d.traits[t] ?? 0 }))
    .filter(({ u, v }) => Math.sign(u) === Math.sign(v) && Math.abs(u) >= 0.3 && Math.abs(v) >= 0.3)
    .sort((a, b) => Math.abs(b.u * b.v) - Math.abs(a.u * a.v))
    .map(({ t, u }) => poleOf(t, u));
}

export interface Reason {
  pole: Pole;
  /** The person's leaning it answers ("Warm weather"). */
  label: Bilingual;
  /** What the place offers for it ("more than 280 sunny days a year"). */
  text: Bilingual;
}

export interface Recommendation {
  destination: Destination;
  /** Whole percent. */
  match: number;
  /** The poles behind the pick, strongest first. */
  because: Pole[];
  /** Up to three reasons, strongest first. */
  reasons: Reason[];
  /** The reasons in one line, for compact places. */
  why: Bilingual;
}

const cap = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

/** Why a place fits, from the reasons tied to the traits that matched. */
export function reasonsFor(d: Destination, because: Pole[]): Reason[] {
  return because
    .filter((p) => d.reasons[p])
    .slice(0, 3)
    .map((pole) => ({ pole, label: POLE_LABELS[pole], text: d.reasons[pole]! }));
}

/** The reasons as one line ("Sunny almost all year · the Alcázar…"), or the place's own line when none match. */
export function explain(d: Destination, because: Pole[]): Bilingual {
  const r = reasonsFor(d, because);
  if (!r.length) return d.about;
  return { en: cap(r.map((x) => x.text.en).join(" · ")), fr: cap(r.map((x) => x.text.fr).join(" · ")) };
}

/**
 * The best matches, at most two per region so the list opens up the world rather than repeating
 * one corner of it. Places already shown can be left out to discover new ones.
 */
export function recommend(p: Profile, opts: { count?: number; exclude?: string[]; catalog?: Destination[] } = {}): Recommendation[] {
  const { count = 5, exclude = [], catalog = DESTINATIONS } = opts;
  if (p.answered < MIN_ANSWERS) return [];
  const ranked = catalog
    .filter((d) => !exclude.includes(d.id))
    .map((d) => ({ d, score: matchScore(p, d) }))
    .sort((a, b) => b.score - a.score || a.d.id.localeCompare(b.d.id));
  const perRegion = new Map<string, number>();
  const out: Recommendation[] = [];
  for (const { d, score } of ranked) {
    if (out.length >= count) break;
    const n = perRegion.get(d.region) ?? 0;
    if (n >= 2) continue;
    perRegion.set(d.region, n + 1);
    const because = agreements(p, d);
    out.push({ destination: d, match: Math.round(score * 100), because, reasons: reasonsFor(d, because), why: explain(d, because) });
  }
  return out;
}

export interface Personality {
  id: string;
  name: Bilingual;
  description: Bilingual;
  /** The traits that define it. */
  shape: TraitVector;
}

export const PERSONALITIES: Personality[] = [
  { id: "tropical-explorer", name: { en: "The Tropical Explorer", fr: "L'Explorateur tropical" }, description: { en: "You're drawn to warm light, turquoise water and places that feel far from everyday life.", fr: "Vous êtes attiré par la lumière chaude, l'eau turquoise et les lieux loin du quotidien." }, shape: { climate: 1, terrain: 0.7, distance: 0.5, energy: 0.3 } },
  { id: "alpine-soul", name: { en: "The Alpine Soul", fr: "L'Âme alpine" }, description: { en: "Fresh snow, big peaks and a warm fire at the end of the day: the mountains are where you feel most alive.", fr: "Neige fraîche, grands sommets et un bon feu en fin de journée : c'est en montagne que vous vous sentez vivant." }, shape: { climate: -1, terrain: -1, setting: -0.7 } },
  { id: "urban-aesthete", name: { en: "The Urban Aesthete", fr: "L'Esthète urbain" }, description: { en: "Skylines, design and great tables. You collect cities the way others collect souvenirs.", fr: "Gratte-ciel, design et belles tables. Vous collectionnez les villes comme d'autres les souvenirs." }, shape: { setting: 1, era: -0.7, style: 0.6, energy: 0.4 } },
  { id: "culture-seeker", name: { en: "The Culture Seeker", fr: "Le Chercheur de culture" }, description: { en: "Old streets, local life and centuries of stories. You travel to understand a place, not just to see it.", fr: "Vieilles rues, vie locale et siècles d'histoire. Vous voyagez pour comprendre un lieu, pas seulement le voir." }, shape: { era: 1, style: -0.6, setting: 0.4, distance: 0.4 } },
  { id: "slow-wanderer", name: { en: "The Slow Wanderer", fr: "Le Flâneur" }, description: { en: "Long lunches, no alarm and nowhere to be. For you the best trips are the ones that slow time down.", fr: "Longs repas, pas de réveil et nulle part où aller. Pour vous, les plus beaux voyages ralentissent le temps." }, shape: { pace: -1, energy: -0.6, style: -0.4, fame: -0.3 } },
  { id: "luxury-escapist", name: { en: "The Luxury Escapist", fr: "L'Évadé de luxe" }, description: { en: "Privacy, beautiful rooms and flawless service. You travel to be taken care of, somewhere stunning.", fr: "Intimité, belles chambres et service impeccable. Vous voyagez pour être choyé, dans un cadre sublime." }, shape: { style: 1, budget: 1, social: -0.6, energy: -0.4 } },
  { id: "trailblazer", name: { en: "The Trailblazer", fr: "L'Éclaireur" }, description: { en: "Empty trails and places few people have heard of. You'd rather discover than follow.", fr: "Sentiers déserts et lieux dont peu ont entendu parler. Vous préférez découvrir que suivre." }, shape: { fame: -1, setting: -0.7, style: -0.4, pace: 0.4 } },
  { id: "city-spark", name: { en: "The City Spark", fr: "L'Étincelle urbaine" }, description: { en: "Crowded bars, new friends and nights that end at sunrise. You travel for the energy of people.", fr: "Bars bondés, nouvelles rencontres et nuits qui finissent à l'aube. Vous voyagez pour l'énergie des gens." }, shape: { energy: 1, social: 1, setting: 0.7, pace: 0.5 } },
  { id: "coastal-romantic", name: { en: "The Coastal Romantic", fr: "Le Romantique du littoral" }, description: { en: "Sea views, quiet villages and sunsets made for two. You're happiest where the land meets the water.", fr: "Vue sur la mer, villages paisibles et couchers de soleil à deux. Vous êtes heureux là où la terre rencontre l'eau." }, shape: { terrain: 1, energy: -0.5, social: -0.5, era: 0.4, climate: 0.5 } },
  { id: "northern-dreamer", name: { en: "The Northern Dreamer", fr: "Le Rêveur du Nord" }, description: { en: "Northern lights, wild coasts and silence. The colder and quieter, the more it moves you.", fr: "Aurores boréales, côtes sauvages et silence. Plus c'est froid et calme, plus ça vous émeut." }, shape: { climate: -1, setting: -0.6, energy: -0.6, fame: -0.5 } },
  { id: "savvy-nomad", name: { en: "The Savvy Nomad", fr: "Le Nomade avisé" }, description: { en: "Street food, local buses and big experiences for small budgets. You know the richest trips aren't the priciest.", fr: "Street food, bus locaux et grandes expériences à petit budget. Vous savez que les plus beaux voyages ne sont pas les plus chers." }, shape: { budget: -1, style: -0.8, distance: 0.6, energy: 0.3 } },
];

/** The personality whose defining traits the profile matches best. */
export function personalityFor(p: Profile, list: Personality[] = PERSONALITIES): Personality {
  let best = list[0];
  let bestScore = -Infinity;
  for (const pers of list) {
    let num = 0;
    let den = 0;
    for (const [t, s] of Object.entries(pers.shape) as [Trait, number][]) {
      num += (p.vector[t] ?? 0) * s;
      den += Math.abs(s);
    }
    const score = den ? num / den : 0;
    if (score > bestScore) {
      bestScore = score;
      best = pers;
    }
  }
  return best;
}

/** The person's strongest leanings, as labels. */
export function characteristics(p: Profile, count = 4): { pole: Pole; label: Bilingual }[] {
  return (Object.entries(p.vector) as [Trait, number][])
    .filter(([, v]) => Math.abs(v) >= 0.3)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, count)
    .map(([t, v]) => {
      const pole = poleOf(t, v);
      return { pole, label: POLE_LABELS[pole] };
    });
}

const MONTHS: Record<Lang, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
};

/** "Apr–Jun, Sep–Oct": the best months as ranges, wrapping over the new year. */
export function bestSeason(months: number[], lang: Lang) {
  const set = new Set(months);
  if (set.size === 12) return lang === "fr" ? "Toute l'année" : "All year";
  // Start each range at a month whose previous month isn't in the set.
  const starts = [...set].filter((m) => !set.has(m === 1 ? 12 : m - 1)).sort((a, b) => a - b);
  const ranges = starts.map((start) => {
    let end = start;
    while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
    return start === end ? MONTHS[lang][start - 1] : `${MONTHS[lang][start - 1]}–${MONTHS[lang][end - 1]}`;
  });
  return ranges.join(", ");
}

export const BUDGET_LABELS: Record<BudgetTier, Bilingual> = {
  1: { en: "Budget-friendly", fr: "Économique" },
  2: { en: "Moderate", fr: "Modéré" },
  3: { en: "Upscale", fr: "Haut de gamme" },
  4: { en: "Luxury", fr: "Luxe" },
};

export const budgetSymbol = (tier: BudgetTier) => "$".repeat(tier);
