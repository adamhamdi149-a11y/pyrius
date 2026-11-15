import { ageOn } from "@/lib/providers/duffel";
import type { FlightSearchParams } from "@/lib/types";
import type { TravellerIn } from "./flightCheckout";

const TITLES = ["mr", "ms", "mrs", "miss", "dr"] as const;
const NAME = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{1,40}$/;

/** The traveller kinds a search books, in the order the fare lists its passengers. */
export const travellerKinds = (p: FlightSearchParams): TravellerIn["kind"][] => [
  ...Array<TravellerIn["kind"]>(p.adults).fill("adult"),
  ...Array<TravellerIn["kind"]>(p.children).fill("child"),
  ...Array<TravellerIn["kind"]>(p.infants ?? 0).fill("infant"),
];

/** One traveller from the form, checked field by field: the clean traveller, or why it's wrong. */
export function cleanTraveller(v: unknown, kind: TravellerIn["kind"], p: FlightSearchParams, today = new Date().toISOString().slice(0, 10)): TravellerIn | string {
  const t = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof t[k] === "string" ? (t[k] as string).trim() : "");
  const title = TITLES.find((x) => x === str("title"));
  const g = str("gender");
  const gender = g === "m" || g === "f" ? g : undefined;
  const givenName = str("givenName");
  const familyName = str("familyName");
  const bornOn = str("bornOn");
  const email = str("email");
  const phone = str("phone").replace(/[\s().-]/g, "");
  if (!title || !gender) return "Choose a title and gender for every traveller.";
  if (!NAME.test(givenName) || !NAME.test(familyName)) return "Enter first and last names as they appear on the passport, in Latin letters.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bornOn) || Number.isNaN(Date.parse(bornOn)) || bornOn > today) return "Enter a valid date of birth for every traveller.";
  const age = ageOn(bornOn, p.returnDate ?? p.departDate);
  if (age > 120) return "Enter a valid date of birth for every traveller.";
  if (kind === "adult" && age < 18) return "Adults must be 18 or older on the day of travel.";
  if (kind === "child" && (age < 2 || age > 17)) return "Children must be 2 to 17 years old on the day of travel.";
  if (kind === "infant" && age >= 2) return "Lap infants must be under 2 on the day of travel.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return "Enter a valid email address.";
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return "Enter the phone number with its country code, like +1 514 555 0123.";
  return { kind, title, gender, givenName, familyName, bornOn, email, phone };
}
