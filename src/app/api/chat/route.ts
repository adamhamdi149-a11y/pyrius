import { NextResponse } from "next/server";
import { runAgent } from "@/lib/ai/agent";
import { ConciergeError, runConcierge, type ConciergeRequest } from "@/lib/ai/concierge";
import { cleanCounts, cleanHistory, cleanLocale, cleanPlan, cleanResults, cleanSaved, cleanToday, cleanTrip, code, oneOf, STAGES } from "@/lib/ai/concierge/clean";
import { allow } from "@/lib/ai/concierge/rateLimit";
import { cleanUploads, UploadProblem, type CleanUpload } from "@/lib/ai/concierge/uploads";
import type { SavedSummary } from "@/lib/ai/concierge/tools";
import { getUserFromRequest } from "@/lib/supabase/server";
import type { ChipAction, Locale, PlanId, TripPreferences, AgentStage } from "@/lib/types";

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
  /** Photos and files sent with the message (mobile app): { name, type, data (base64) }. */
  uploads?: unknown;
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
  const locale: Locale = cleanLocale(body.locale);
  let uploads: CleanUpload[];
  try {
    uploads = cleanUploads(body.uploads);
  } catch (e) {
    if (e instanceof UploadProblem) return NextResponse.json({ error: e.message, code: "bad_upload" }, { status: 400 });
    throw e;
  }
  const typed = typeof body.message === "string" ? body.message.trim() : "";
  // Files sent without a message still need a turn for the AI to answer.
  const filesOnly = uploads.length ? (locale === "fr" ? "Voici ce que je vous envoie." : "Here's what I'm sending you.") : "";
  const message = (body.action ? actionText(body.action, locale) : "") || typed || filesOnly;
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

  const today = cleanToday(body.today);
  const history = cleanHistory(body.history);
  const saved = cleanSaved(body.saved);

  try {
    const reply = await runConcierge({
      message,
      uploads,
      history,
      trip: prefs,
      stage,
      locale,
      homeAirport: code(body.homeAirport),
      today,
      results: cleanResults(body.results),
      saved,
      plan: cleanPlan(body.plan),
      counts: cleanCounts(body.counts, saved),
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
