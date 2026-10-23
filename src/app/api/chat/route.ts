import { NextResponse } from "next/server";
import { runAgent, type Extracted } from "@/lib/ai/agent";
import { AIRPORTS } from "@/lib/data/catalog";
import type { AgentStage, ChipAction, Locale, TripPreferences } from "@/lib/types";

export const runtime = "nodejs";

interface Body {
  message: string;
  action?: ChipAction;
  prefs: TripPreferences;
  stage: AgentStage;
  locale?: Locale;
  homeAirport?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

const CODES = AIRPORTS.map((a) => `${a.code} (${a.city})`).join(", ");

/** Ask the model only to extract fields. Output is validated before use; it never produces offers or prices. */
async function extractWithOpenAI(body: Body): Promise<Extracted | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You extract travel search fields from the user's latest message. Today is ${new Date().toISOString().slice(0, 10)}. Supported airports: ${CODES}. Map countries/regions to the closest supported airport. Return JSON with any of: originCode, destinationCode, departDate (YYYY-MM-DD, future), returnDate, durationDays, flexibleDates, adults, children, budget (number, total flight budget, 0 = no budget), nonstopOnly, carryOnOnly, priority ("cheapest"|"fastest"|"balanced"), wantsWarm, rooms, stayBudgetPerNight. Omit unknown fields. Never invent values the user did not state. Current known trip: ${JSON.stringify(body.prefs)}. The assistant is currently waiting for: ${body.prefs.awaiting ?? "nothing specific"}.`,
        },
        ...(body.history ?? []).slice(-6),
        { role: "user", content: body.message },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const raw = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  const codes = new Set(AIRPORTS.map((a) => a.code));
  const today = new Date().toISOString().slice(0, 10);
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && v > today ? v : undefined);
  const num = (v: unknown, max: number) => (typeof v === "number" && v >= 0 && v <= max ? Math.round(v) : undefined);
  const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
  const e: Extracted = {
    originCode: codes.has(raw.originCode) ? raw.originCode : undefined,
    destinationCode: codes.has(raw.destinationCode) ? raw.destinationCode : undefined,
    departDate: date(raw.departDate),
    returnDate: date(raw.returnDate),
    durationDays: num(raw.durationDays, 90) || undefined,
    adults: num(raw.adults, 9) || undefined,
    children: num(raw.children, 6),
    budget: num(raw.budget, 100000),
    flexibleDates: bool(raw.flexibleDates),
    nonstopOnly: bool(raw.nonstopOnly),
    carryOnOnly: bool(raw.carryOnOnly),
    wantsWarm: bool(raw.wantsWarm),
    rooms: num(raw.rooms, 9) || undefined,
    stayBudgetPerNight: num(raw.stayBudgetPerNight, 20000),
    priority: ["cheapest", "fastest", "balanced"].includes(raw.priority) ? raw.priority : undefined,
  };
  (Object.keys(e) as (keyof Extracted)[]).forEach((k) => e[k] === undefined && delete e[k]);
  return e;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if ((!message && !body.action) || message.length > 2000) {
    return NextResponse.json({ error: "Message must be 1–2000 characters" }, { status: 400 });
  }
  const state = { prefs: body.prefs ?? { currency: "CAD" as const }, stage: body.stage ?? "collecting" };
  const input = { message, action: body.action, locale: body.locale === "fr" ? ("fr" as const) : ("en" as const), homeAirport: body.homeAirport };
  try {
    // Chip actions are already structured; only free text goes to the model.
    const extracted = body.action && body.action.type !== "say" ? null : await extractWithOpenAI({ ...body, message: body.action?.type === "say" ? body.action.text : message });
    if (extracted) return NextResponse.json(await runAgent(state, input, extracted, "openai"));
  } catch (err) {
    console.error("OpenAI extraction failed, falling back to demo parser:", err);
  }
  return NextResponse.json(await runAgent(state, input));
}
