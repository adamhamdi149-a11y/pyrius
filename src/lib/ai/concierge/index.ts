import { placeName } from "@/lib/data/world";
import { flightBrief, type FlightBrief } from "@/lib/flights/brief";
import type { HotelBrief } from "@/lib/hotels/brief";
import { flightMode, getProviders } from "@/lib/providers";
import type { AgentReply, AgentStage, Attachment, Chip, DataSource, FlightSearchParams, HotelSearchParams, PlanId, TripPreferences, WebSource } from "@/lib/types";
import { contextMessage, INSTRUCTIONS, REPLY_FORMAT } from "./prompt";
import { runTool, TOOLS, type SavedSummary, type TurnState } from "./tools";

/**
 * The AI concierge. OpenAI reads the conversation and decides what to do; every action
 * goes through runTool, which validates it and runs real application code. The server
 * owns the instructions, the tool list, the limits and the final checks on the reply.
 */

export interface ConciergeRequest {
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  trip: TripPreferences;
  stage: AgentStage;
  locale: "en" | "fr";
  homeAirport?: string;
  today: string;
  results: {
    /** The flight cards the user is looking at, in the order shown. */
    flights?: { params: FlightSearchParams; sort?: "price" | "duration" | "depart"; source?: DataSource; fetchedAt?: string; shown: FlightBrief[] };
    /** The stay cards the user is looking at, cheapest first. */
    hotels?: { params: HotelSearchParams; shown: HotelBrief[] };
  };
  saved: SavedSummary[];
  plan: PlanId;
  counts: { saved: number; trackers: number };
}

export class ConciergeError extends Error {
  constructor(public code: "rate_limited" | "timeout" | "unavailable" | "bad_response", message: string) {
    super(message);
  }
}

const MODEL = () => process.env.OPENAI_MODEL || "gpt-5.4-mini";
const EFFORT = () => process.env.OPENAI_REASONING || "low";
const reasoningModel = () => /^(gpt-5|o\d)/.test(MODEL());
const MAX_ROUNDS = 6;
const CALL_TIMEOUT_MS = 30_000;
const TURN_BUDGET_MS = 55_000;

/** OpenAI's hosted web search, for current travel information and official sites. Never a source of fares. */
const WEB_SEARCH = { type: "web_search", search_context_size: "low", user_location: { type: "approximate", country: "CA" } } as const;

type Annotation = { type: string; url?: string; title?: string };
type OutputItem = { type: string; call_id?: string; name?: string; arguments?: string; content?: { type: string; text?: string; annotations?: Annotation[] }[] };

async function callOpenAI(input: unknown[], opts: { forceAnswer?: boolean; deadline: number }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ConciergeError("unavailable", "OpenAI is not configured");
  const left = opts.deadline - Date.now();
  if (left < 3000) throw new ConciergeError("timeout", "Turn took too long");
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(Math.min(CALL_TIMEOUT_MS, left)),
      body: JSON.stringify({
        model: MODEL(),
        instructions: INSTRUCTIONS,
        input,
        tools: [...TOOLS, WEB_SEARCH],
        tool_choice: opts.forceAnswer ? "none" : "auto",
        parallel_tool_calls: true,
        // At most two web searches per step keeps answers quick and the cost bounded.
        max_tool_calls: 2,
        // Older chat models (gpt-4o, gpt-4.1) don't take a reasoning setting.
        ...(reasoningModel() ? { reasoning: { effort: EFFORT() } } : {}),
        text: { format: REPLY_FORMAT },
        max_output_tokens: 2500,
        // Nothing is stored on OpenAI's side for later retrieval; reasoning is passed back encrypted.
        store: false,
        include: reasoningModel() ? ["reasoning.encrypted_content"] : [],
      }),
    });
  } catch (err) {
    const name = (err as Error).name;
    throw new ConciergeError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "unavailable", "Could not reach OpenAI");
  }
  if (res.status === 429) throw new ConciergeError("rate_limited", "OpenAI rate limit");
  if (!res.ok) {
    // Log the status and OpenAI's error message only, never the conversation.
    const detail = await res.json().then((j) => j?.error?.message as string | undefined).catch(() => undefined);
    console.error("OpenAI responses error", res.status, detail?.slice(0, 300) ?? "");
    throw new ConciergeError("unavailable", `OpenAI ${res.status}`);
  }
  return (await res.json()) as { status: string; output: OutputItem[] };
}

/** Plain text for the chat bubble: inline citations move to the sources list, markdown emphasis goes. */
function plain(text: string) {
  return text
    .replace(/\s*\(\[[^\]]*\]\((https?:[^)]+)\)\)/g, "")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .trim();
}

function finalText(output: OutputItem[]) {
  const msg = output.find((o) => o.type === "message");
  const part = msg?.content?.find((c) => c.type === "output_text");
  if (!part?.text) return null;
  try {
    const j = JSON.parse(part.text) as { reply?: unknown; suggestions?: unknown; topic?: unknown };
    if (typeof j.reply !== "string" || !j.reply.trim()) return null;
    const sources: WebSource[] = [];
    for (const a of part.annotations ?? []) {
      if (a.type !== "url_citation" || !a.url || sources.some((s) => s.url === a.url)) continue;
      try {
        const u = new URL(a.url);
        if (u.protocol === "https:" || u.protocol === "http:") sources.push({ title: (a.title || u.hostname).slice(0, 120), url: u.toString() });
      } catch {}
    }
    return {
      reply: plain(j.reply),
      suggestions: Array.isArray(j.suggestions) ? j.suggestions.filter((x): x is string => typeof x === "string") : [],
      topic: j.topic === "off_topic" ? ("off_topic" as const) : ("travel" as const),
      sources: sources.slice(0, 5),
    };
  } catch {
    return null;
  }
}

/** The offers the user is looking at, in the order the cards show them, so "the second one" resolves. */
function shownResults(r: ConciergeRequest["results"]) {
  const out: string[] = [];
  if (r.flights?.shown.length) {
    const live = r.flights.source === "live";
    out.push(
      `Flight cards currently shown (${placeName(r.flights.params.originCode)} → ${placeName(r.flights.params.destinationCode)}, ${live ? `live offers retrieved ${r.flights.fetchedAt ?? "earlier"}` : "demo examples"}, sorted by ${r.flights.sort ?? "price"}): ` +
        r.flights.shown
          .slice(0, 10)
          .map((f) => `#${f.n} id=${f.id} ${f.airline}: ${f.out}${f.back ? ` / back ${f.back}` : ""}, ${f.price} ${f.currency}${f.return_chosen_at_booking ? " (round trip with the cheapest return, added when booking)" : ""}${f.bags ? `, ${f.bags}` : ""}${f.conditions.length ? ` [${f.conditions.join("; ")}]` : ""}`)
          .join("; "),
    );
  } else if (r.flights) {
    out.push("Earlier flight results in this conversation are no longer available to you; search again if the user refers to them.");
  }
  if (r.hotels?.shown.length) {
    out.push(
      `Stay cards currently shown (live from Google Hotels, ${placeName(r.hotels.params.destinationCode)}, ${r.hotels.params.checkIn} to ${r.hotels.params.checkOut}, in the order shown): ${r.hotels.shown
        .slice(0, 12)
        .map((h) => `#${h.n} id=${h.id} ${h.name} (${h.type}${h.stars ? `, ${h.stars}★` : ""}${h.rating !== null ? `, rated ${h.rating}/5${h.reviews ? ` from ${h.reviews} reviews` : ""}` : ""}) ${h.per_night}/night, ${h.total} ${h.currency} for ${h.nights} nights`)
        .join("; ")}`,
    );
  }
  return out.join("\n");
}

/** Conversations from before results were stored with the reply: in demo mode the same demo search rebuilds them. */
async function restoreShown(r: ConciergeRequest["results"]) {
  if (!r.flights || r.flights.shown.length || flightMode() !== "demo") return r;
  const offers = await getProviders().flights.search(r.flights.params);
  const sorted = [...offers].sort((a, b) => a.totalPrice - b.totalPrice);
  return { ...r, flights: { ...r.flights, source: "demo" as const, shown: sorted.slice(0, 12).map((o, i) => flightBrief(o, i + 1)) } };
}

export async function runConcierge(req: ConciergeRequest): Promise<AgentReply> {
  const deadline = Date.now() + TURN_BUDGET_MS;
  const results = await restoreShown(req.results).catch(() => req.results);
  const state: TurnState = {
    trip: { ...req.trip, currency: req.trip.currency ?? "CAD" },
    today: req.today,
    locale: req.locale,
    flights: results.flights?.shown.length ? { params: results.flights.params, source: results.flights.source ?? "live", fetchedAt: results.flights.fetchedAt, shown: results.flights.shown } : undefined,
    hotels: results.hotels?.shown.length ? results.hotels : undefined,
    saved: req.saved,
    plan: req.plan,
    counts: { ...req.counts },
    attachments: [],
    actions: [],
    toolCalls: 0,
  };

  const shown = shownResults(results);
  const context = contextMessage({
    today: req.today,
    locale: req.locale,
    homeAirport: req.homeAirport,
    trip: state.trip,
    stage: req.stage,
    saved: req.saved,
    flightMode: flightMode(),
  });

  const input: unknown[] = [
    { role: "developer", content: shown ? `${context}\n${shown}` : context },
    ...req.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: req.message },
  ];

  let final: ReturnType<typeof finalText> = null;
  for (let round = 0; round < MAX_ROUNDS && !final; round++) {
    const res = await callOpenAI(input, { deadline, forceAnswer: round === MAX_ROUNDS - 1 });
    input.push(...res.output);
    const calls = res.output.filter((o) => o.type === "function_call");
    if (!calls.length) {
      final = finalText(res.output);
      if (!final) throw new ConciergeError("bad_response", `Unreadable reply (${res.status})`);
      break;
    }
    // Independent calls in one round run together; the trip update is applied first.
    calls.sort((x, y) => Number(y.name === "update_trip") - Number(x.name === "update_trip"));
    for (const c of calls) {
      const out = await runTool(c.name ?? "", c.arguments ?? "{}", state).catch((err) => {
        console.error("Tool failed", c.name, (err as Error).message);
        return { ok: false, error: "The travel provider didn't respond. Tell the user to try again in a moment." };
      });
      input.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify(out) });
    }
  }
  if (!final) throw new ConciergeError("bad_response", "No final answer");

  // Server-side boundary: an off-topic reply stays short and can't carry results, changes or sources.
  const offTopic = final.topic === "off_topic" && state.toolCalls === 0;
  const reply = offTopic ? clip(final.reply, 280) : clip(final.reply, 1400);
  const chips: Chip[] = [...new Set(final.suggestions.map((s) => s.trim()).filter((s) => s && s.length <= 48))]
    .slice(0, 3)
    .map((label) => ({ label, action: { type: "say", text: label } }));

  const t = state.trip;
  const stage: AgentStage = state.searched ?? (req.stage === "collecting" || !req.stage ? "collecting" : req.stage);
  const attachments: Attachment[] = offTopic ? [] : state.attachments;
  return {
    reply,
    chips,
    prefs: t,
    stage,
    attachments: attachments.length ? attachments : undefined,
    actions: offTopic || !state.actions.length ? undefined : state.actions,
    sources: offTopic || !final.sources.length ? undefined : final.sources,
    title: t.originCode && t.destinationCode ? `${placeName(t.originCode, req.locale)} → ${placeName(t.destinationCode, req.locale)}` : undefined,
    engine: "openai",
  };
}

function clip(s: string, max: number) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}
