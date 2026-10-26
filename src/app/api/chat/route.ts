import { NextResponse } from "next/server";
import { runAgent } from "@/lib/ai/agent";
import { ConciergeError, runConcierge, type ConciergeRequest } from "@/lib/ai/concierge";
import { allow } from "@/lib/ai/concierge/rateLimit";
import { cleanFlightParams } from "@/lib/apiGate";
import type { FlightBrief } from "@/lib/flights/brief";
import type { SavedSummary } from "@/lib/ai/concierge/tools";
import { isAirportCode } from "@/lib/data/world";
import { PLANS } from "@/lib/plans";
import { getUserFromRequest } from "@/lib/supabase/server";
import type { HotelBrief } from "@/lib/hotels/brief";
import type { AgentStage, ChipAction, HotelSearchParams, Locale, PlanId, TripPreferences } from "@/lib/types";
import { toISODate } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  message: string;
  action?: ChipAction;
  prefs: TripPreferences;
  stage: AgentStage;
  locale?: Locale;
  homeAirport?: string;
  today?: string;
  history?: { role: "user" | "assistant"; content: string }[];
  results?: ConciergeRequest["results"];
  saved?: SavedSummary[];
  plan?: PlanId;
  counts?: { saved?: number; trackers?: number };
}

const STAGES: AgentStage[] = ["collecting", "flights", "offer-hotels", "hotels", "offer-cars", "cars", "done"];
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const intIn = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
const numIn = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[]) => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const code = (v: unknown) => (isAirportCode(v) ? v : undefined);

/** The trip comes from the browser, so every field is checked before it reaches the model or a search. */
function cleanTrip(p: unknown): TripPreferences {
  const t = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
  const out: TripPreferences = {
    currency: oneOf(t.currency, ["CAD", "USD", "EUR"] as const) ?? "CAD",
    originCode: code(t.originCode),
    destinationCode: code(t.destinationCode),
    departDate: isDate(t.departDate) ? t.departDate : undefined,
    returnDate: isDate(t.returnDate) ? t.returnDate : undefined,
    durationDays: intIn(t.durationDays, 1, 90),
    flexibleDates: bool(t.flexibleDates),
    adults: intIn(t.adults, 1, 9),
    children: intIn(t.children, 0, 8),
    budget: numIn(t.budget, 0, 200000),
    budgetPerPerson: numIn(t.budgetPerPerson, 1, 200000),
    nonstopOnly: bool(t.nonstopOnly),
    carryOnOnly: bool(t.carryOnOnly),
    priority: oneOf(t.priority, ["cheapest", "fastest", "balanced"] as const),
    wantsWarm: bool(t.wantsWarm),
    rooms: intIn(t.rooms, 1, 9),
    stayType: oneOf(t.stayType, ["hotel", "apartment"] as const),
    stayBudgetPerNight: numIn(t.stayBudgetPerNight, 0, 20000),
    carMode: oneOf(t.carMode, ["rental", "agencies", "dealerships"] as const),
    tripType: oneOf(t.tripType, ["round", "oneway"] as const),
    cabin: oneOf(t.cabin, ["economy", "premium_economy", "business", "first"] as const),
    departureTime: oneOf(t.departureTime, ["morning", "afternoon", "evening"] as const),
    notes: typeof t.notes === "string" ? t.notes.slice(0, 200) : undefined,
    awaiting: oneOf(t.awaiting, ["origin", "destination", "warm-pick", "dates", "duration", "travelers", "budget", "prefs", "stay-details"] as const),
    askedPrefs: bool(t.askedPrefs),
  };
  (Object.keys(out) as (keyof TripPreferences)[]).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

function cleanFlights(v: unknown): ConciergeRequest["results"]["flights"] {
  const f = v as { params?: unknown; sort?: string; source?: string; fetchedAt?: string; shown?: unknown[] } | undefined;
  const params = cleanFlightParams(f?.params);
  if (!params) return undefined;
  const str = (x: unknown, n = 200) => (typeof x === "string" ? x.slice(0, n) : "");
  // Summaries of the cards on screen: text and numbers only, bounded, never instructions.
  const shown: FlightBrief[] = (Array.isArray(f!.shown) ? f!.shown : []).slice(0, 30).flatMap((raw, i) => {
    const b = raw as Record<string, unknown>;
    if (!b || typeof b.id !== "string" || !/^[\w-]{3,80}$/.test(b.id)) return [];
    return [{
      n: i + 1,
      id: b.id,
      airline: str(b.airline, 80),
      out: str(b.out),
      back: typeof b.back === "string" ? str(b.back) : null,
      price: numIn(b.price, 0, 1_000_000) ?? 0,
      per_traveler: numIn(b.per_traveler, 0, 1_000_000) ?? 0,
      currency: str(b.currency, 3) || "CAD",
      cabin: str(b.cabin, 30),
      bags: typeof b.bags === "string" ? str(b.bags, 80) : null,
      stops: intIn(b.stops, 0, 10) ?? 0,
      duration_min: intIn(b.duration_min, 0, 10000) ?? 0,
      return_chosen_at_booking: b.return_chosen_at_booking === true,
      notes: Array.isArray(b.notes) ? b.notes.filter((x): x is string => typeof x === "string").slice(0, 3).map((x) => x.slice(0, 120)) : [],
      conditions: Array.isArray(b.conditions) ? b.conditions.filter((x): x is string => typeof x === "string").slice(0, 5).map((x) => x.slice(0, 100)) : [],
    }];
  });
  return {
    params,
    sort: oneOf(f!.sort, ["price", "duration", "depart"] as const),
    source: f!.source === "demo" ? "demo" : "live",
    fetchedAt: typeof f!.fetchedAt === "string" && !Number.isNaN(Date.parse(f!.fetchedAt)) ? f!.fetchedAt : undefined,
    shown,
  };
}

function cleanHotelParams(v: unknown): HotelSearchParams | undefined {
  const h = v as Partial<HotelSearchParams> | undefined;
  if (!h || !code(h.destinationCode) || !isDate(h.checkIn) || !isDate(h.checkOut)) return undefined;
  return {
    destinationCode: h.destinationCode!,
    checkIn: h.checkIn,
    checkOut: h.checkOut,
    guests: intIn(h.guests, 1, 17) ?? 1,
    rooms: intIn(h.rooms, 1, 9) ?? 1,
    currency: oneOf(h.currency, ["CAD", "USD", "EUR"] as const) ?? "CAD",
    stayType: oneOf(h.stayType, ["hotel", "apartment"] as const),
  };
}

/** The stay cards on screen: text and numbers only, bounded, never instructions. */
function cleanHotels(v: unknown): ConciergeRequest["results"]["hotels"] {
  const h = v as { params?: unknown; shown?: unknown[] } | undefined;
  const params = cleanHotelParams(h?.params);
  if (!params) return undefined;
  const str = (x: unknown, n = 160) => (typeof x === "string" ? x.slice(0, n) : "");
  const shown: HotelBrief[] = (Array.isArray(h!.shown) ? h!.shown : []).slice(0, 24).flatMap((raw, i) => {
    const b = raw as Record<string, unknown>;
    if (!b || typeof b.id !== "string" || !/^[\w-]{3,80}$/.test(b.id)) return [];
    return [{
      n: i + 1,
      id: b.id,
      name: str(b.name, 120),
      type: str(b.type, 30),
      stars: intIn(b.stars, 0, 5) ?? 0,
      rating: numIn(b.rating, 0, 10) ?? null,
      reviews: intIn(b.reviews, 0, 10_000_000) ?? null,
      per_night: numIn(b.per_night, 0, 1_000_000) ?? 0,
      total: numIn(b.total, 0, 10_000_000) ?? 0,
      nights: intIn(b.nights, 1, 400) ?? 1,
      currency: str(b.currency, 3) || "CAD",
      amenities: (Array.isArray(b.amenities) ? b.amenities : []).slice(0, 6).map((a) => str(a, 40)),
      address: typeof b.address === "string" ? str(b.address) : null,
    }];
  });
  return { params, shown };
}

/** Quick-reply buttons with a structured action become a plain request for the AI. */
function actionText(a: ChipAction, locale: Locale) {
  const L = (en: string, fr: string) => (locale === "fr" ? fr : en);
  switch (a.type) {
    case "say":
      return a.text;
    case "hotels":
      return a.stayType === "apartment" ? L("Show me apartments for this trip.", "Montre-moi des appartements pour ce voyage.") : L("Show me hotels for this trip.", "Montre-moi des hôtels pour ce voyage.");
    case "skip-hotels":
      return L("I don't need a place to stay.", "Je n'ai pas besoin d'hébergement.");
    case "cars":
      return a.mode === "dealerships"
        ? L("Help me find car dealerships there.", "Aide-moi à trouver des concessionnaires sur place.")
        : L("Find car rental agencies at my destination.", "Trouve des agences de location de voitures à destination.");
    case "charter":
      return a.mode === "jets"
        ? L("Find private jet charters for this trip.", "Trouve des vols en jet privé pour ce voyage.")
        : L("Find yacht charters at my destination.", "Trouve des locations de yacht à destination.");
    case "skip-cars":
      return L("I don't need a car. That's everything for now.", "Je n'ai pas besoin de voiture. C'est tout pour le moment.");
    default:
      return "";
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const locale: Locale = body.locale === "fr" ? "fr" : "en";
  const typed = typeof body.message === "string" ? body.message.trim() : "";
  const message = (body.action ? actionText(body.action, locale) : "") || typed;
  if (!message || message.length > 2000) return NextResponse.json({ error: "Message must be 1–2000 characters" }, { status: 400 });

  const prefs = cleanTrip(body.prefs);
  const stage = oneOf(body.stage, STAGES) ?? "collecting";

  // Without a key (local development), the built-in demo engine answers.
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(await runAgent({ prefs, stage }, { message: typed, action: body.action, locale, homeAirport: code(body.homeAirport) }));
  }

  // The AI costs money per request, so in production it needs a signed-in user.
  const supabaseOn = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const user = supabaseOn ? await getUserFromRequest(req) : null;
  if (supabaseOn && !user && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Please sign in to chat with Pyrius." }, { status: 401 });
  }
  const who = user?.id ?? `ip:${req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}`;
  const gate = allow(who);
  if (!gate.ok) {
    return NextResponse.json({ error: "You're sending messages very quickly. Give it a moment and try again.", code: "slow_down" }, { status: 429, headers: { "Retry-After": String(gate.retryAfter) } });
  }

  // Today in the user's timezone, if it's within a day of the server's.
  const server = toISODate(new Date());
  const today = isDate(body.today) && Math.abs(new Date(body.today).getTime() - new Date(server).getTime()) <= 864e5 ? body.today : server;

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));

  const saved: SavedSummary[] = (Array.isArray(body.saved) ? body.saved : [])
    .filter((s) => s && typeof s.id === "string" && ["flight", "hotel", "car"].includes(s.kind))
    .slice(0, 60)
    .map((s) => ({
      id: s.id.slice(0, 120),
      kind: s.kind,
      label: String(s.label ?? "").slice(0, 120),
      price: numIn(s.price, 0, 1_000_000) ?? 0,
      currency: String(s.currency ?? "CAD").slice(0, 3),
      tracked: Boolean(s.tracked),
      target: numIn(s.target, 0, 1_000_000),
    }));

  try {
    const reply = await runConcierge({
      message,
      history,
      trip: prefs,
      stage,
      locale,
      homeAirport: code(body.homeAirport),
      today,
      results: { flights: cleanFlights(body.results?.flights), hotels: cleanHotels(body.results?.hotels) },
      saved,
      plan: oneOf(body.plan, PLANS.map((p) => p.id)) ?? "free",
      counts: { saved: intIn(body.counts?.saved, 0, 100000) ?? saved.length, trackers: intIn(body.counts?.trackers, 0, 100000) ?? saved.filter((s) => s.tracked).length },
    });
    return NextResponse.json(reply);
  } catch (err) {
    const e = err instanceof ConciergeError ? err : null;
    if (!e) console.error("Concierge failed:", (err as Error).message);
    const map = {
      rate_limited: [503, "Pyrius is very busy right now. Please try again in a moment."],
      timeout: [504, "That took too long to answer. Please try again."],
      unavailable: [502, "Pyrius couldn't reach its AI service. Please try again."],
      bad_response: [502, "Pyrius couldn't put an answer together. Please try again."],
    } as const;
    const [status, error] = map[e?.code ?? "unavailable"];
    return NextResponse.json({ error, code: e?.code ?? "unavailable" }, { status });
  }
}
