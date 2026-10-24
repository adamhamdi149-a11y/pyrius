import { cityName } from "@/lib/data/catalog";
import { getProviders } from "@/lib/providers";
import type { AgentReply, AgentStage, Attachment, CarSearchParams, Chip, FlightOffer, FlightSearchParams, HotelSearchParams, PlanId, TripPreferences } from "@/lib/types";
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
    flights?: { params: FlightSearchParams; sort?: "price" | "duration" | "depart"; nonstopOnly?: boolean; carryOnOnly?: boolean };
    hotels?: HotelSearchParams;
    cars?: CarSearchParams;
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
const MAX_ROUNDS = 6;
const CALL_TIMEOUT_MS = 25_000;
const TURN_BUDGET_MS = 50_000;

type OutputItem = { type: string; call_id?: string; name?: string; arguments?: string; content?: { type: string; text?: string }[] };

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
        tools: TOOLS,
        tool_choice: opts.forceAnswer ? "none" : "auto",
        parallel_tool_calls: true,
        // Older chat models (gpt-4o, gpt-4.1) don't take a reasoning setting.
        ...(/^(gpt-5|o\d)/.test(MODEL()) ? { reasoning: { effort: EFFORT() } } : {}),
        text: { format: REPLY_FORMAT },
        max_output_tokens: 2000,
        // Nothing is stored on OpenAI's side for later retrieval; reasoning is passed back encrypted.
        store: false,
        include: /^(gpt-5|o\d)/.test(MODEL()) ? ["reasoning.encrypted_content"] : [],
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

function finalText(output: OutputItem[]) {
  const msg = output.find((o) => o.type === "message");
  const text = msg?.content?.find((c) => c.type === "output_text")?.text;
  if (!text) return null;
  try {
    const j = JSON.parse(text) as { reply?: unknown; suggestions?: unknown; topic?: unknown };
    if (typeof j.reply !== "string" || !j.reply.trim()) return null;
    return {
      reply: j.reply.trim(),
      suggestions: Array.isArray(j.suggestions) ? j.suggestions.filter((x): x is string => typeof x === "string") : [],
      topic: j.topic === "off_topic" ? ("off_topic" as const) : ("travel" as const),
    };
  } catch {
    return null;
  }
}

const totalMin = (o: FlightOffer) => o.outbound.durationMin + (o.inbound?.durationMin ?? 0);

/** The offers the user is looking at, in the order the cards show them, so "the second one" resolves. */
async function shownResults(r: ConciergeRequest["results"]) {
  const p = getProviders();
  const out: string[] = [];
  if (r.flights) {
    let list = await p.flights.search(r.flights.params);
    const nonstop = (o: FlightOffer) => o.outbound.stops === 0 && (!o.inbound || o.inbound.stops === 0);
    if (r.flights.nonstopOnly) list = list.filter(nonstop);
    if (r.flights.carryOnOnly) list = list.filter((o) => o.baggage.carryOn);
    const sort = r.flights.sort ?? "price";
    list = [...list].sort((x, y) => (sort === "duration" ? totalMin(x) - totalMin(y) : sort === "depart" ? x.outbound.depart.localeCompare(y.outbound.depart) : x.totalPrice - y.totalPrice));
    out.push(
      `Flight cards currently shown (${cityName(r.flights.params.originCode)} → ${cityName(r.flights.params.destinationCode)}, sorted by ${sort}): ` +
        list
          .slice(0, 8)
          .map((o, i) => `#${i + 1} id=${o.id} ${o.airline.name} departs ${o.outbound.depart.slice(11, 16)}, ${o.outbound.stops ? `${o.outbound.stops} stop` : "nonstop"}, ${Math.round(totalMin(o) / 60)}h total, ${o.baggage.carryOn ? "carry-on" : "no carry-on"} + ${o.baggage.checked} checked, ${o.totalPrice} ${o.currency}`)
          .join("; "),
    );
  }
  if (r.hotels) {
    const list = [...(await p.hotels.search(r.hotels))].sort((x, y) => x.pricePerNight - y.pricePerNight);
    out.push(
      `Stay cards shown (cheapest first): ${list
        .slice(0, 12)
        .map((h, i) => `#${i + 1} id=${h.id} ${h.name} (${h.type}, ${h.stars}★, ${h.neighborhood}) ${h.pricePerNight}/night, ${h.freeCancellation ? "free cancellation" : "no free cancellation"}, ${h.breakfastIncluded ? "breakfast" : "no breakfast"}`)
        .join("; ")}`,
    );
  }
  if (r.cars) {
    const list = [...(await p.cars.search(r.cars))].sort((x, y) => x.totalPrice - y.totalPrice);
    out.push(`Car cards shown (cheapest first): ${list.slice(0, 8).map((c, i) => `#${i + 1} id=${c.id} ${c.category} (${c.example}) ${c.supplier}, ${c.seats} seats, ${c.transmission}, ${c.totalPrice} total`).join("; ")}`);
  }
  return out.join("\n");
}

export async function runConcierge(req: ConciergeRequest): Promise<AgentReply> {
  const deadline = Date.now() + TURN_BUDGET_MS;
  const state: TurnState = {
    trip: { ...req.trip, currency: req.trip.currency ?? "CAD" },
    today: req.today,
    locale: req.locale,
    results: { flights: req.results.flights?.params, hotels: req.results.hotels, cars: req.results.cars },
    saved: req.saved,
    plan: req.plan,
    counts: { ...req.counts },
    attachments: [],
    actions: [],
    toolCalls: 0,
  };

  const shown = await shownResults(req.results).catch(() => "");
  const context = contextMessage({
    today: req.today,
    locale: req.locale,
    homeAirport: req.homeAirport,
    trip: state.trip,
    stage: req.stage,
    saved: req.saved,
    hasResults: { flights: Boolean(req.results.flights), hotels: Boolean(req.results.hotels), cars: Boolean(req.results.cars) },
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

  // Server-side boundary: an off-topic reply stays short and can't carry results or changes.
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
    title: t.originCode && t.destinationCode ? `${cityName(t.originCode, req.locale)} → ${cityName(t.destinationCode, req.locale)}` : undefined,
    engine: "openai",
  };
}

function clip(s: string, max: number) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}
