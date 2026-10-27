import { placeName } from "@/lib/data/world";
import { tripKind, type FlightStep } from "@/lib/flights/workflow";
import type { FlightSearchParams, FlightSnapshot, TripPreferences } from "@/lib/types";
import { formatRange, money } from "@/lib/utils";
import { shortDate } from "./Calendar";

/**
 * What Pyrius says when the user moves the trip forward with a control. Written from the trip
 * itself (no AI call), so the next step appears instantly and never contradicts the workflow.
 */

type Loc = "en" | "fr";
const say = (locale: Loc, en: string, fr: string) => (locale === "fr" ? fr : en);

export const GREETING = (locale: Loc) => say(locale, "Let's find your next flight. Where are you heading?", "Trouvons votre prochain vol. Où allez-vous ?");

export function stepMessage(t: TripPreferences, step: FlightStep, locale: Loc): string {
  const to = t.destinationCode ? placeName(t.destinationCode, locale) : "";
  const from = t.originCode ? placeName(t.originCode, locale) : "";
  switch (step) {
    case "destination":
      return GREETING(locale);
    case "origin":
      return say(locale, `${to} it is. Where are you flying from?`, `Va pour ${to}. D'où partez-vous ?`);
    case "dates":
      return t.departDate && tripKind(t) === "round"
        ? say(locale, `Leaving ${shortDate(t.departDate, "en")}. When are you coming back?`, `Départ le ${shortDate(t.departDate, "fr")}. Quand revenez-vous ?`)
        : say(locale, `${from} to ${to}. When are you travelling?`, `${from} vers ${to}. Quand voyagez-vous ?`);
    case "legs":
      return say(locale, "Lay out your route: each flight's airports and date, in order.", "Tracez votre itinéraire : les aéroports et la date de chaque vol, dans l'ordre.");
    case "ready":
      return tripKind(t) === "multi"
        ? say(locale, "Your route is set. Check who's travelling, then search live fares for each flight.", "Votre itinéraire est prêt. Vérifiez les voyageurs, puis cherchez les tarifs de chaque vol.")
        : say(
            locale,
            `${from} to ${to}, ${formatRange(t.departDate!, tripKind(t) === "round" ? t.returnDate : undefined, "en")}${tripKind(t) === "oneway" ? ", one way" : ""}. Check who's travelling, then search live fares.`,
            `${from} vers ${to}, ${formatRange(t.departDate!, tripKind(t) === "round" ? t.returnDate : undefined, "fr")}${tripKind(t) === "oneway" ? ", aller simple" : ""}. Vérifiez les voyageurs, puis lancez la recherche.`,
          );
    case "results":
      return "";
  }
}

/** What the user's choice reads like in the conversation. */
export function echo(kind: "destination" | "origin" | "dates" | "legs", t: TripPreferences, locale: Loc): string {
  if (kind === "destination") return `${placeName(t.destinationCode, locale)} (${t.destinationCode})`;
  if (kind === "origin") return say(locale, `From ${placeName(t.originCode, locale)} (${t.originCode})`, `Au départ de ${placeName(t.originCode, locale)} (${t.originCode})`);
  if (kind === "legs") return [t.legs?.[0]?.from, ...(t.legs ?? []).map((l) => l.to)].join(" → ");
  return tripKind(t) === "round" ? formatRange(t.departDate!, t.returnDate, locale) : `${shortDate(t.departDate, locale)}${say(locale, ", one way", ", aller simple")}`;
}

/** A plain account of what the search returned, from the results themselves. */
export function resultsMessage(plan: FlightSearchParams[], snaps: FlightSnapshot[], locale: Loc): string {
  if (plan.length > 1) {
    const empty = snaps.filter((s) => !s.offers.length).length;
    return say(
      locale,
      `Here are live fares for each of your ${plan.length} flights. Each one is its own ticket, booked separately.${empty ? ` Google Flights found nothing for ${empty} of them; try other dates for those.` : ""}`,
      `Voici les tarifs en direct pour chacun de vos ${plan.length} vols. Chacun est un billet séparé.${empty ? ` Google Flights n'a rien trouvé pour ${empty} d'entre eux; essayez d'autres dates.` : ""}`,
    );
  }
  const p = plan[0];
  const route = `${placeName(p.originCode, locale)} → ${placeName(p.destinationCode, locale)}`;
  const offers = snaps[0].offers;
  if (!offers.length)
    return say(locale, `Google Flights has no flights for ${route} on these dates. Try other dates or a nearby airport.`, `Google Flights n'a aucun vol ${route} à ces dates. Essayez d'autres dates ou un aéroport voisin.`);
  const best = offers.reduce((a, b) => (b.totalPrice < a.totalPrice ? b : a));
  const n = offers.length;
  return say(
    locale,
    `Here ${n === 1 ? "is 1 live fare" : `are ${n} live fares`} for ${route}, ${formatRange(p.departDate, p.returnDate, "en")}. The lowest is ${money(best.totalPrice, best.currency, "en")} with ${best.airline.name}${p.returnDate ? " for the round trip" : ""}.`,
    `Voici ${n === 1 ? "1 tarif" : `${n} tarifs`} en direct pour ${route}, ${formatRange(p.departDate, p.returnDate, "fr")}. Le plus bas : ${money(best.totalPrice, best.currency, "fr")} avec ${best.airline.name}${p.returnDate ? " pour l'aller-retour" : ""}.`,
  );
}
