import { AIRPORTS, imageUrl } from "@/lib/data/catalog";

/**
 * The hand-picked Unsplash photos the website uses for its destinations (lib/data/catalog), so the
 * app shows the same images. Unsplash serves them from its own CDN; no key is needed.
 */

/** Places the apps name by title that have a catalog photo (Explore uses English Wikipedia titles). */
const TITLES: Record<string, string> = {
  lisbon: "LIS",
  kyoto: "KIX",
  tokyo: "HND",
  bali: "DPS",
  maldives: "MLE",
  iceland: "KEF",
  paris: "CDG",
  rome: "FCO",
  barcelona: "BCN",
  dubai: "DXB",
  santorini: "JTR",
  "new york city": "JFK",
  "new york": "JFK",
  manhattan: "JFK",
  london: "LHR",
  madrid: "MAD",
  venice: "VCE",
  sydney: "SYD",
  miami: "MIA",
  honolulu: "HNL",
  "punta cana": "PUJ",
  cancun: "CUN",
  "rio de janeiro": "GIG",
  "san francisco": "SFO",
};

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** The catalog photo for an airport code or a place title, sized for `width`, or null. */
export function curatedPhoto(title: string, code: string | null, width: number) {
  const t = fold(title);
  // An airport's photo only stands for the place when it's that airport's city (Venice's photo isn't the Dolomites).
  const byCode = code ? AIRPORTS.find((a) => a.code === code && a.image && (fold(a.city).includes(t) || t.includes(fold(a.city)))) : undefined;
  const c = TITLES[t] ?? byCode?.code;
  const image = c ? AIRPORTS.find((a) => a.code === c)?.image : undefined;
  const id = image?.match(/photo-([\w-]+)\?/)?.[1];
  return id ? imageUrl(id, width) : null;
}
