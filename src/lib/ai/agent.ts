import { AIRPORTS, airportByCode, cityName } from "@/lib/data/catalog";
import { getProviders } from "@/lib/providers";
import type { AgentReply, AgentStage, Attachment, AwaitField, Chip, ChipAction, Locale, TripPreferences } from "@/lib/types";
import { addDays, daysBetween, formatRange, money, toISODate } from "@/lib/utils";
import { carsQuestion, staysQuestion } from "./followups";
import { completeDates, norm, parseMessage, type Extracted } from "./parse";

export type { Extracted } from "./parse";

/**
 * Conversation engine. It only collects structured preferences and decides when to
 * trigger a search through the provider interface — it never writes offers or prices itself.
 * An LLM (when configured) contributes validated field extraction; this engine stays in charge.
 */

export interface AgentInput {
  message: string;
  action?: ChipAction;
  locale: Locale;
  homeAirport?: string;
  today?: Date;
}

interface State {
  prefs: TripPreferences;
  stage: AgentStage;
}


function travelersText(p: TripPreferences, L: (en: string, fr: string) => string) {
  const a = p.adults ?? 1;
  const c = p.children ?? 0;
  const en = `${a} adult${a > 1 ? "s" : ""}${c ? `, ${c} child${c > 1 ? "ren" : ""}` : ""}`;
  const fr = `${a} adulte${a > 1 ? "s" : ""}${c ? `, ${c} enfant${c > 1 ? "s" : ""}` : ""}`;
  return L(en, fr);
}

function merge(prefs: TripPreferences, e: Extracted): { prefs: TripPreferences; changed: (keyof Extracted)[] } {
  const next: TripPreferences = { ...prefs };
  const changed: (keyof Extracted)[] = [];
  const set = <K extends keyof TripPreferences & keyof Extracted>(k: K) => {
    if (e[k] !== undefined && e[k] !== prefs[k]) {
      (next as unknown as Record<string, unknown>)[k] = e[k];
      changed.push(k);
    }
  };
  (["originCode", "destinationCode", "departDate", "returnDate", "durationDays", "flexibleDates", "adults", "children", "budget", "nonstopOnly", "carryOnOnly", "priority", "wantsWarm", "rooms", "stayBudgetPerNight"] as const).forEach(set);
  if (e.departDate && !e.returnDate && prefs.returnDate && prefs.departDate !== e.departDate) {
    // New departure: keep the same trip length.
    const len = prefs.departDate ? daysBetween(prefs.departDate, prefs.returnDate) : prefs.durationDays;
    next.returnDate = undefined;
    next.durationDays = len;
  }
  if (e.durationDays && !e.returnDate && next.departDate) next.returnDate = addDays(next.departDate, e.durationDays);
  if (e.approxDate) next.flexibleDates = true;
  if (next.destinationCode && next.destinationCode === next.originCode) {
    next.destinationCode = prefs.destinationCode === next.originCode ? undefined : prefs.destinationCode;
  }
  return { prefs: completeDates(next), changed };
}

function nextMissing(p: TripPreferences): AwaitField | null {
  if (!p.originCode) return "origin";
  if (!p.destinationCode) return p.wantsWarm ? "warm-pick" : "destination";
  if (!p.departDate) return "dates";
  if (!p.returnDate) return "duration";
  if (p.adults === undefined) return "travelers";
  if (p.budget === undefined) return "budget";
  if (!p.askedPrefs && p.nonstopOnly === undefined && p.carryOnOnly === undefined && p.priority === undefined) return "prefs";
  return null;
}

const say = (label: string, text = label): Chip => ({ label, action: { type: "say", text } });

async function warmCandidates(p: TripPreferences) {
  const origin = airportByCode(p.originCode);
  const near = origin?.region === "na" ? ["carib", "latam", "na", "oceania"] : ["carib", "latam", "asia", "me", "eu"];
  const pool = AIRPORTS.filter((a) => a.warm && a.code !== p.originCode && near.includes(a.region));
  const depart = p.departDate ?? addDays(toISODate(new Date()), 45);
  const ret = p.returnDate ?? addDays(depart, p.durationDays ?? 7);
  const { flights } = getProviders();
  const priced = await Promise.all(
    pool.map(async (a) => {
      const offers = await flights.search({ originCode: p.originCode!, destinationCode: a.code, departDate: depart, returnDate: ret, adults: 1, children: 0, currency: p.currency });
      return { a, low: offers[0]?.pricePerTraveler ?? Infinity };
    }),
  );
  return priced.sort((x, y) => x.low - y.low).slice(0, 3).map((x) => x.a);
}

async function question(field: AwaitField, p: TripPreferences, input: AgentInput, L: (en: string, fr: string) => string): Promise<{ text: string; chips: Chip[] }> {
  switch (field) {
    case "origin": {
      const home = airportByCode(input.homeAirport);
      const picks = [home, ...["YUL", "YYZ", "YVR"].map(airportByCode)].filter((a, i, arr) => a && arr.indexOf(a) === i).slice(0, 3);
      return {
        text: L("Where will you be departing from?", "De quelle ville partez-vous ?"),
        chips: picks.map((a) => say(`${cityName(a!.code, input.locale)} (${a!.code})`, L(`From ${a!.city}`, `De ${cityName(a!.code, "fr")}`))),
      };
    }
    case "destination":
      return {
        text: L("Where would you like to go? A city, a country, or just a feeling.", "Où aimeriez-vous aller ? Une ville, un pays ou simplement une envie."),
        chips: [say(L("Somewhere warm", "Au chaud")), say("Tokyo"), say("Paris"), say(L("Lisbon", "Lisbonne"), "Lisbon")],
      };
    case "warm-pick": {
      const picks = await warmCandidates(p);
      const names = picks.map((a) => cityName(a.code, input.locale));
      const when = p.departDate ? formatRange(p.departDate, undefined, input.locale).replace(/^\w+\.?,?\s/, "") : "";
      return {
        text: L(
          `For warm weather from ${cityName(p.originCode, input.locale)}${when ? ` around ${when}` : ""}, I'd start with ${names.slice(0, -1).join(", ")} or ${names.at(-1)} — they show the lowest fares in my demo data. Which one appeals?`,
          `Pour du soleil au départ de ${cityName(p.originCode, input.locale)}${when ? ` vers le ${when}` : ""}, je commencerais par ${names.slice(0, -1).join(", ")} ou ${names.at(-1)} — les tarifs les plus bas dans mes données de démonstration. Laquelle vous tente ?`,
        ),
        chips: picks.map((a) => say(cityName(a.code, input.locale), L(`To ${a.city}`, `Vers ${cityName(a.code, "fr")}`))),
      };
    }
    case "dates":
      return {
        text: L("What dates are you considering? A rough month is perfectly fine.", "Quelles dates envisagez-vous ? Un mois approximatif suffit."),
        chips: [say(L("Next month", "Le mois prochain")), say(L("In February", "En février")), say(L("This weekend", "Ce week-end")), say(L("I'm flexible", "Je suis flexible"))],
      };
    case "duration":
      if (p.adults === undefined)
        return {
          text: L("How long would you like to stay, and how many people are traveling?", "Combien de temps souhaitez-vous rester, et combien de voyageurs serez-vous ?"),
          chips: [
            say(L("1 week · just me", "1 semaine · seul"), L("1 week, just me", "1 semaine, juste moi")),
            say(L("1 week · 2 adults", "1 semaine · 2 adultes"), L("1 week, 2 adults", "1 semaine, 2 adultes")),
            say(L("10 days · 2 adults", "10 jours · 2 adultes"), L("10 days, 2 adults", "10 jours, 2 adultes")),
            say(L("2 weeks · family of 4", "2 semaines · famille de 4"), L("2 weeks, 2 adults and 2 kids", "2 semaines, 2 adultes et 2 enfants")),
          ],
        };
      return {
        text: L("How long would you like to stay?", "Combien de temps souhaitez-vous rester ?"),
        chips: [say(L("A long weekend", "Un long week-end")), say(L("One week", "Une semaine")), say(L("10 days", "10 jours")), say(L("Two weeks", "Deux semaines"))],
      };
    case "travelers":
      return {
        text: L("How many people are traveling?", "Combien de personnes voyagent ?"),
        chips: [say(L("Just me", "Juste moi")), say(L("Two adults", "Deux adultes"), "2 adults"), say(L("2 adults, 2 children", "2 adultes, 2 enfants"), "2 adults, 2 children")],
      };
    case "budget":
      return {
        text: L(
          `Do you have a budget for the flights? I'll treat it as the total for ${travelersText(p, L)}.`,
          `Avez-vous un budget pour les vols ? Je le considère comme le total pour ${travelersText(p, L)}.`,
        ),
        chips: [say(L("Under $800", "Moins de 800 $"), "under $800"), say(L("Under $1,500", "Moins de 1 500 $"), "under $1500"), say(L("Under $3,000", "Moins de 3 000 $"), "under $3000"), say(L("No fixed budget", "Pas de budget fixe"), "no budget")],
      };
    case "prefs":
      return {
        text: L("Last thing — any preferences on stops or baggage?", "Dernière chose : des préférences pour les escales ou les bagages ?"),
        chips: [say(L("Nonstop only", "Vols directs"), "nonstop"), say(L("Carry-on only", "Bagage à main seulement"), "carry-on only"), say(L("Cheapest option", "Le moins cher"), "cheapest"), say(L("No preference", "Aucune préférence"), "no preference")],
      };
    default:
      return { text: "", chips: [] };
  }
}

function ack(changed: (keyof Extracted)[], p: TripPreferences, L: (en: string, fr: string) => string, firstTurn: boolean, input: AgentInput) {
  if (firstTurn) return changed.length ? L("Sounds good.", "Avec plaisir.") : L("I'd love to help.", "Avec plaisir.");
  if (changed.includes("destinationCode") && p.destinationCode) return L(`${cityName(p.destinationCode, input.locale)} — lovely choice.`, `${cityName(p.destinationCode, input.locale)}, excellent choix.`);
  if (changed.includes("originCode") && p.originCode) return L(`Leaving from ${cityName(p.originCode, input.locale)}, got it.`, `Départ de ${cityName(p.originCode, input.locale)}, c'est noté.`);
  if (changed.includes("returnDate") || changed.includes("durationDays")) return L("Perfect.", "Parfait.");
  if (changed.includes("departDate")) return L("Noted.", "C'est noté.");
  if (changed.includes("adults")) return L("Great.", "Très bien.");
  if (changed.includes("budget")) return L("Understood.", "Compris.");
  return "";
}

async function flightResults(p: TripPreferences, input: AgentInput, L: (en: string, fr: string) => string, updated: boolean): Promise<AgentReply> {
  const params = {
    originCode: p.originCode!,
    destinationCode: p.destinationCode!,
    departDate: p.departDate!,
    returnDate: p.returnDate,
    adults: p.adults ?? 1,
    children: p.children ?? 0,
    currency: p.currency,
  };
  const offers = await getProviders().flights.search(params);
  const nonstop = offers.filter((o) => o.outbound.stops === 0).length;
  const within = p.budget ? offers.filter((o) => o.totalPrice <= p.budget!).length : offers.length;
  const range = formatRange(p.departDate!, p.returnDate, input.locale);
  const route = `${cityName(p.originCode, input.locale)} → ${cityName(p.destinationCode, input.locale)}`;
  let text = updated
    ? L(`Updated. Here are ${offers.length} options for ${route}, ${range}.`, `C'est à jour. Voici ${offers.length} options pour ${route}, ${range}.`)
    : L(
        `I've prepared ${offers.length} round-trip options for ${route}, ${range}, for ${travelersText(p, L)}.`,
        `J'ai préparé ${offers.length} options aller-retour pour ${route}, ${range}, pour ${travelersText(p, L)}.`,
      );
  if (p.budget) {
    text += " " + (within
      ? L(`${within} fit within your ${money(p.budget, p.currency)} budget.`, `${within} respectent votre budget de ${money(p.budget, p.currency, "fr")}.`)
      : L(`None fit within ${money(p.budget, p.currency)} in this demo data — the closest are at the top.`, `Aucune ne respecte ${money(p.budget, p.currency, "fr")} dans ces données de démo ; les plus proches sont en haut.`));
  }
  if (p.nonstopOnly && !nonstop) text += " " + L("There are no nonstop options on this route, so I've included connections.", "Il n'y a pas de vol direct sur ce trajet, j'ai donc inclus les correspondances.");
  text += " " + L("Prices are demo data, not live fares. Save one you like and I'll help you find a place to stay.", "Les prix sont des données de démonstration, pas des tarifs en direct. Enregistrez une option et je vous aiderai à trouver un hébergement.");

  const attachment: Attachment = {
    type: "flights",
    params,
    budget: p.budget || undefined,
    filters: { nonstopOnly: p.nonstopOnly && nonstop > 0, carryOnOnly: p.carryOnOnly, sort: p.priority === "fastest" ? "duration" : "price" },
  };
  return {
    reply: text,
    prefs: { ...p, awaiting: undefined },
    stage: "flights",
    attachment,
    title: route,
    engine: "demo",
    chips: [
      p.nonstopOnly ? say(L("Allow connections", "Accepter les escales"), "allow connections") : say(L("Nonstop only", "Vols directs"), "nonstop"),
      say(L("Change dates", "Changer les dates")),
      { label: L("Find a place to stay", "Trouver un hébergement"), action: { type: "hotels", stayType: "hotel" } },
    ],
  };
}

function hotelAsk(p: TripPreferences, input: AgentInput, L: (en: string, fr: string) => string, stayType: "hotel" | "apartment"): AgentReply {
  const guests = (p.adults ?? 1) + (p.children ?? 0);
  const range = formatRange(p.departDate!, p.returnDate, input.locale);
  const kind = stayType === "apartment" ? L("apartments and other stays", "appartements et autres hébergements") : L("hotels", "hôtels");
  return {
    reply: L(
      `I'll look for ${kind} in ${cityName(p.destinationCode, input.locale)}, ${range}, for ${guests} guest${guests > 1 ? "s" : ""}. How many rooms do you need, and is there a nightly budget I should keep to?`,
      `Je cherche des ${kind} à ${cityName(p.destinationCode, input.locale)}, ${range}, pour ${guests} personne${guests > 1 ? "s" : ""}. Combien de chambres vous faut-il, et avez-vous un budget par nuit ?`,
    ),
    prefs: { ...p, stayType, awaiting: "stay-details" },
    stage: "hotels",
    engine: "demo",
    chips: [
      say(L("1 room · any budget", "1 chambre · tout budget"), L("1 room, no budget", "1 chambre, pas de budget")),
      say(L("1 room · under $200/night", "1 chambre · moins de 200 $/nuit"), L("1 room under $200 per night", "1 chambre moins de 200 $ par nuit")),
      say(L("2 rooms · under $350/night", "2 chambres · moins de 350 $/nuit"), L("2 rooms under $350 per night", "2 chambres moins de 350 $ par nuit")),
    ],
  };
}

async function hotelResults(p: TripPreferences, input: AgentInput, L: (en: string, fr: string) => string): Promise<AgentReply> {
  const guests = (p.adults ?? 1) + (p.children ?? 0);
  const rooms = p.rooms ?? Math.max(1, Math.ceil((p.adults ?? 1) / 2));
  const params = { destinationCode: p.destinationCode!, checkIn: p.departDate!, checkOut: p.returnDate!, guests, rooms, currency: p.currency, stayType: p.stayType };
  const offers = await getProviders().hotels.search(params);
  const nights = daysBetween(params.checkIn, params.checkOut);
  const fit = p.stayBudgetPerNight ? offers.filter((h) => h.pricePerNight <= p.stayBudgetPerNight!).length : offers.length;
  const what = p.stayType === "apartment" ? L("stays", "hébergements") : L("hotels", "hôtels");
  let text = L(
    `Here are ${offers.length} ${what} in ${cityName(p.destinationCode, input.locale)} for ${nights} nights, ${rooms} room${rooms > 1 ? "s" : ""}.`,
    `Voici ${offers.length} ${what} à ${cityName(p.destinationCode, input.locale)} pour ${nights} nuits, ${rooms} chambre${rooms > 1 ? "s" : ""}.`,
  );
  if (p.stayBudgetPerNight) text += " " + L(`${fit} are within ${money(p.stayBudgetPerNight, p.currency)} per night.`, `${fit} sont sous ${money(p.stayBudgetPerNight, p.currency, "fr")} par nuit.`);
  text += " " + L("Property names, ratings and prices are illustrative demo data — not real listings or availability.", "Les noms, notes et prix sont des données de démonstration — pas de vraies annonces ni disponibilités.");
  return {
    reply: text,
    prefs: { ...p, rooms, awaiting: undefined },
    stage: "hotels",
    engine: "demo",
    attachment: { type: "hotels", params, budgetPerNight: p.stayBudgetPerNight || undefined },
    chips: [
      p.stayType === "apartment"
        ? { label: L("Show hotels instead", "Voir plutôt des hôtels"), action: { type: "hotels", stayType: "hotel" } }
        : { label: L("Show apartments", "Voir des appartements"), action: { type: "hotels", stayType: "apartment" } },
      { label: L("Next: getting around", "Ensuite : se déplacer"), action: { type: "skip-hotels" } },
    ],
  };
}

async function carStep(mode: "rental" | "agencies" | "dealerships", p: TripPreferences, input: AgentInput, L: (en: string, fr: string) => string): Promise<AgentReply> {
  const city = cityName(p.destinationCode, input.locale);
  if (mode === "rental") {
    const params = { destinationCode: p.destinationCode!, pickUp: p.departDate!, dropOff: p.returnDate!, currency: p.currency };
    const offers = await getProviders().cars.search(params);
    return {
      reply: L(
        `Here are ${offers.length} rental options for pick-up at ${city} airport, ${formatRange(params.pickUp, params.dropOff, input.locale)}. Demo prices — the rental company confirms the final price and availability when you book with them.`,
        `Voici ${offers.length} options de location avec prise en charge à l'aéroport de ${city}, ${formatRange(params.pickUp, params.dropOff, input.locale)}. Prix de démonstration — le loueur confirme le prix final et la disponibilité lors de la réservation.`,
      ),
      prefs: { ...p, carMode: mode },
      stage: "cars",
      engine: "demo",
      attachment: { type: "cars", params },
      chips: [
        { label: L("Local rental agencies", "Agences de location locales"), action: { type: "cars", mode: "agencies" } },
        { label: L("Finish planning", "Terminer"), action: { type: "skip-cars" } },
      ],
    };
  }
  const dealer = mode === "dealerships";
  return {
    reply: dealer
      ? L(
          `Just so we're clear: dealerships sell vehicles — they don't usually rent them. I don't have a verified business directory connected yet, so I won't invent names, phone numbers or addresses. You can search the map for dealerships around ${city} below.`,
          `Précision : les concessionnaires vendent des véhicules, ils n'en louent généralement pas. Aucun annuaire d'entreprises vérifié n'est encore connecté, je n'inventerai donc ni noms, ni numéros, ni adresses. Vous pouvez chercher des concessionnaires près de ${city} sur la carte ci-dessous.`,
        )
      : L(
          `I don't have a verified local business directory connected yet, so I won't make up agency names or phone numbers. You can search the map for rental agencies around ${city} below.`,
          `Aucun annuaire local vérifié n'est encore connecté, je n'inventerai donc pas de noms d'agences ni de numéros. Vous pouvez chercher des agences de location près de ${city} sur la carte ci-dessous.`,
        ),
    prefs: { ...p, carMode: mode },
    stage: "cars",
    engine: "demo",
    attachment: { type: "businesses", destinationCode: p.destinationCode!, category: dealer ? "Car dealership" : "Car rental agency" },
    chips: [
      { label: L("Compare rental cars", "Comparer les locations"), action: { type: "cars", mode: "rental" } },
      { label: L("Finish planning", "Terminer"), action: { type: "skip-cars" } },
    ],
  };
}

function wrapUp(p: TripPreferences, input: AgentInput, L: (en: string, fr: string) => string): AgentReply {
  const route = `${cityName(p.originCode, input.locale)} → ${cityName(p.destinationCode, input.locale)}`;
  return {
    reply: L(
      `Your trip is taking shape: ${route}, ${formatRange(p.departDate!, p.returnDate, input.locale)}. Everything you saved is in your dashboard, and tracked prices live under Price tracking. When you're ready, you'll complete each booking directly with the provider — Pyrius never books or charges on your behalf.`,
      `Votre voyage prend forme : ${route}, ${formatRange(p.departDate!, p.returnDate, input.locale)}. Tout ce que vous avez enregistré se trouve dans votre tableau de bord, et les prix suivis dans Suivi des prix. Vous finaliserez chaque réservation directement auprès du fournisseur — Pyrius ne réserve et ne facture jamais à votre place.`,
    ),
    prefs: p,
    stage: "done",
    engine: "demo",
    chips: [
      { label: L("Open dashboard", "Ouvrir le tableau de bord"), action: { type: "navigate", href: "/dashboard" } },
      { label: L("Price tracking", "Suivi des prix"), action: { type: "navigate", href: "/tracking" } },
    ],
  };
}

export async function runAgent(state: State, input: AgentInput, extracted?: Extracted, engine: "demo" | "openai" = "demo"): Promise<AgentReply> {
  const L = (en: string, fr: string) => (input.locale === "fr" ? fr : en);
  const out = (r: AgentReply): AgentReply => ({ ...r, engine });
  let prefs: TripPreferences = { ...state.prefs, currency: state.prefs.currency ?? "CAD" };
  const tripReady = Boolean(prefs.originCode && prefs.destinationCode && prefs.departDate && prefs.returnDate);
  const a = input.action;

  // 1. Structured chip actions
  if (a && a.type !== "say" && a.type !== "navigate") {
    if (!tripReady) return out({ reply: L("Let's settle the flights first — then I'll help with stays and transport.", "Réglons d'abord les vols, puis je vous aiderai pour l'hébergement et le transport."), prefs, stage: state.stage, engine });
    if (a.type === "hotels") return out(hotelAsk(prefs, input, L, a.stayType));
    if (a.type === "skip-hotels") {
      const q = carsQuestion(input.locale);
      return out({ reply: q.text, chips: q.chips, prefs, stage: "offer-cars", engine });
    }
    if (a.type === "cars") return out(await carStep(a.mode, prefs, input, L));
    if (a.type === "skip-cars") return out(wrapUp(prefs, input, L));
  }

  const text = a?.type === "say" ? a.text : input.message;
  const t = norm(text);

  // 2. Stage-aware intents in free text
  if (tripReady) {
    if (state.stage === "offer-hotels" && /\b(no|skip|non|pas besoin|nope)\b/.test(t)) {
      const q = carsQuestion(input.locale);
      return out({ reply: q.text, chips: q.chips, prefs, stage: "offer-cars", engine });
    }
    if (state.stage === "offer-cars" && /\b(no|skip|non|pas besoin|nope|done|termin)/.test(t)) return out(wrapUp(prefs, input, L));
    if (/apartment|airbnb|appartement|condo|vacation rental/.test(t)) return out(hotelAsk(prefs, input, L, "apartment"));
    if (/\b(hotels?|hotel|stay|stays|accommodation|hebergement|place to stay|lodging)\b/.test(t) || (state.stage === "offer-hotels" && /\b(yes|sure|ok|oui|yep)\b/.test(t)))
      return out(hotelAsk(prefs, input, L, "hotel"));
    if (/dealer|concession/.test(t)) return out(await carStep("dealerships", prefs, input, L));
    if (/agenc/.test(t)) return out(await carStep("agencies", prefs, input, L));
    if (/\b(car|cars|rental|voiture|location)\b/.test(t) || (state.stage === "offer-cars" && /\b(yes|sure|ok|oui|yep)\b/.test(t)))
      return out(await carStep("rental", prefs, input, L));
    if (state.stage === "hotels" && prefs.awaiting === "stay-details") {
      const e = { ...parseMessage(text, prefs, "stay-details", input.today), ...(extracted ?? {}) };
      if (e.rooms) prefs.rooms = e.rooms;
      if (e.stayBudgetPerNight !== undefined) prefs.stayBudgetPerNight = e.stayBudgetPerNight;
      return out(await hotelResults(prefs, input, L));
    }
  }

  // 3. Trip collection and edits
  if (/change (the )?dates|other dates|different dates|changer (les )?dates|autres dates/.test(t)) {
    const len = prefs.departDate && prefs.returnDate ? daysBetween(prefs.departDate, prefs.returnDate) : prefs.durationDays;
    prefs = { ...prefs, departDate: undefined, returnDate: undefined, durationDays: len, awaiting: "dates" };
    return out({ reply: L("Of course. What dates would you like instead?", "Bien sûr. Quelles dates préférez-vous ?"), prefs, stage: "collecting", engine, chips: (await question("dates", prefs, input, L)).chips });
  }
  if (/allow connections|with connections|accepter les escales/.test(t)) prefs = { ...prefs, nonstopOnly: false };

  const parsed = parseMessage(text, prefs, prefs.awaiting, input.today);
  const e: Extracted = { ...parsed, ...(extracted ?? {}) };
  const firstTurn = state.stage === "collecting" && !state.prefs.awaiting && !state.prefs.originCode && !state.prefs.destinationCode;
  const merged = merge(prefs, e);
  prefs = merged.prefs;
  if (e.noPreference || (prefs.awaiting === "prefs" && merged.changed.length)) prefs.askedPrefs = true;
  if (prefs.awaiting === "prefs") prefs.askedPrefs = true;

  const missing = nextMissing(prefs);
  if (!missing) {
    const wasShowing = state.stage !== "collecting";
    if (wasShowing && !merged.changed.length && !/allow connections|accepter/.test(t)) {
      return out({
        reply: L(
          "I can refine these results — try “nonstop only”, “change dates”, or a new budget. Or I can move on to finding a place to stay.",
          "Je peux affiner ces résultats — essayez « vols directs », « changer les dates » ou un nouveau budget. Je peux aussi passer à l'hébergement.",
        ),
        prefs,
        stage: state.stage,
        engine,
        chips: [say(L("Nonstop only", "Vols directs"), "nonstop"), { label: L("Find a place to stay", "Trouver un hébergement"), action: { type: "hotels", stayType: "hotel" } }],
      });
    }
    return out(await flightResults(prefs, input, L, wasShowing));
  }
  if (firstTurn && !merged.changed.length && !e.wantsWarm) {
    // Nothing recognisable yet: ask for the most useful piece.
    const q = await question("destination", prefs, input, L);
    return out({ reply: L(`I'd love to help you plan it. ${q.text}`, `Avec plaisir. ${q.text}`), chips: q.chips, prefs: { ...prefs, awaiting: "destination" }, stage: "collecting", engine });
  }
  const q = await question(missing, prefs, input, L);
  const lead = ack(merged.changed, prefs, L, firstTurn, input);
  const title = prefs.originCode && prefs.destinationCode ? `${cityName(prefs.originCode, input.locale)} → ${cityName(prefs.destinationCode, input.locale)}` : undefined;
  return out({ reply: `${lead ? lead + " " : ""}${q.text}`, chips: q.chips, prefs: { ...prefs, awaiting: missing }, stage: "collecting", engine, title });
}

export { staysQuestion };
