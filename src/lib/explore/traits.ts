/**
 * Pyrius Explore: the travel traits a person's choices are measured on. Each trait runs from -1 to 1
 * between two poles (for climate: cold at -1, warm at 1). Answers move a person along the traits;
 * destinations sit at a point on each of them.
 */

export const TRAITS = ["climate", "energy", "setting", "style", "terrain", "fame", "pace", "era", "social", "budget", "distance"] as const;
export type Trait = (typeof TRAITS)[number];

export type TraitVector = Partial<Record<Trait, number>>;

export type Bilingual = { en: string; fr: string };

/** The two poles of each trait: [at -1, at +1]. */
export const POLES: Record<Trait, [Pole, Pole]> = {
  climate: ["cold", "warm"],
  energy: ["calm", "lively"],
  setting: ["nature", "urban"],
  style: ["authentic", "luxury"],
  terrain: ["mountain", "coast"],
  fame: ["hidden", "iconic"],
  pace: ["slow", "packed"],
  era: ["modern", "historic"],
  social: ["private", "social"],
  budget: ["value", "premium"],
  distance: ["familiar", "faraway"],
};

export type Pole =
  | "cold" | "warm"
  | "calm" | "lively"
  | "nature" | "urban"
  | "authentic" | "luxury"
  | "mountain" | "coast"
  | "hidden" | "iconic"
  | "slow" | "packed"
  | "modern" | "historic"
  | "private" | "social"
  | "value" | "premium"
  | "familiar" | "faraway";

/** How each pole reads as a characteristic of a person. */
export const POLE_LABELS: Record<Pole, Bilingual> = {
  cold: { en: "Snow and crisp air", fr: "Neige et air vif" },
  warm: { en: "Warm weather", fr: "Chaleur et soleil" },
  calm: { en: "Peace and quiet", fr: "Calme et sérénité" },
  lively: { en: "Lively atmosphere", fr: "Ambiance animée" },
  nature: { en: "Nature", fr: "Nature" },
  urban: { en: "City life", fr: "Vie urbaine" },
  authentic: { en: "Authentic experiences", fr: "Expériences authentiques" },
  luxury: { en: "Refined comfort", fr: "Confort raffiné" },
  mountain: { en: "Mountains", fr: "Montagnes" },
  coast: { en: "Coastlines", fr: "Bord de mer" },
  hidden: { en: "Hidden gems", fr: "Trésors cachés" },
  iconic: { en: "Iconic places", fr: "Lieux emblématiques" },
  slow: { en: "Slow travel", fr: "Voyage lent" },
  packed: { en: "Full days", fr: "Journées bien remplies" },
  modern: { en: "Modern design", fr: "Design moderne" },
  historic: { en: "History and old towns", fr: "Histoire et vieilles villes" },
  private: { en: "Privacy", fr: "Intimité" },
  social: { en: "Meeting people", fr: "Rencontres" },
  value: { en: "Great value", fr: "Bon rapport qualité-prix" },
  premium: { en: "Premium experiences", fr: "Expériences haut de gamme" },
  familiar: { en: "Familiar comforts", fr: "Repères familiers" },
  faraway: { en: "Far from the everyday", fr: "Dépaysement total" },
};

/** The pole a value leans to. */
export const poleOf = (trait: Trait, value: number): Pole => POLES[trait][value < 0 ? 0 : 1];
