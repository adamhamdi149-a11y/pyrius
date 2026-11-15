import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { turnContext, turnStateFor } from "@/lib/ai/concierge";
import { cleanCounts, cleanHistory, cleanLocale, cleanPlan, cleanResults, cleanSaved, cleanToday, cleanTrip, code, oneOf, STAGES } from "@/lib/ai/concierge/clean";
import { cleanVoice, MAX_SESSION_SECONDS, REALTIME_MODEL, TRANSCRIBE_MODEL, VOICE_TOOLS, voiceInstructions } from "@/lib/ai/voice";
import { gate } from "@/lib/apiGate";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Voice sessions are the most expensive call Pyrius makes, so they have their own, tighter limit. */
const SESSION_WINDOWS = [
  { ms: 60_000, max: 4 },
  { ms: 24 * 60 * 60_000, max: 60 },
];

/**
 * Starts a voice session: checks the user, builds the instructions and tools on the server, and asks
 * OpenAI for a short-lived client secret. The app uses that secret once, to open its WebRTC
 * connection; the permanent API key never leaves the server.
 */
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Voice isn't set up on this server yet.", code: "not_configured" }, { status: 503 });
  const g = await gate(req, "voice-session", SESSION_WINDOWS);
  if (g instanceof NextResponse) return g;

  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const locale = cleanLocale(body.locale);
  const voice = cleanVoice(body.voice);
  const spoken = body.spoken !== false;
  const trip = cleanTrip(body.prefs);
  const stage = oneOf(body.stage, STAGES) ?? "collecting";
  const today = cleanToday(body.today);
  const saved = cleanSaved(body.saved);
  const { state, results } = await turnStateFor({ trip, today, locale, results: cleanResults(body.results), saved, plan: cleanPlan(body.plan), counts: cleanCounts(body.counts, saved) });
  const context = await turnContext({ today, locale, homeAirport: code(body.homeAirport), stage, saved }, state, results);

  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  // A stable, anonymous id per user lets OpenAI's abuse checks act on one user instead of the whole app.
  if (g.userId) headers["OpenAI-Safety-Identifier"] = createHash("sha256").update(g.userId).digest("hex");

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        // The secret only has to open the connection; the session itself is ended by the app.
        expires_after: { anchor: "created_at", seconds: 120 },
        session: {
          type: "realtime",
          model: REALTIME_MODEL(),
          instructions: voiceInstructions(context, cleanHistory(body.history)),
          output_modalities: spoken ? ["audio"] : ["text"],
          audio: {
            input: {
              noise_reduction: { type: "near_field" },
              transcription: { model: TRANSCRIBE_MODEL() },
              // The model decides when the user has finished, and stops talking when interrupted.
              turn_detection: { type: "semantic_vad", eagerness: "auto", create_response: true, interrupt_response: true },
            },
            output: { voice },
          },
          tools: VOICE_TOOLS,
          tool_choice: "auto",
          max_output_tokens: 1500,
        },
      }),
    });
  } catch {
    return NextResponse.json({ error: "Pyrius couldn't reach its voice service. Please try again.", code: "unavailable" }, { status: 502 });
  }
  if (res.status === 429) return NextResponse.json({ error: "Voice is very busy right now. Please try again in a moment.", code: "rate_limited" }, { status: 503 });
  if (!res.ok) {
    // Status and OpenAI's error message only, never the conversation.
    const detail = await res.json().then((j) => j?.error?.message as string | undefined).catch(() => undefined);
    console.error("OpenAI realtime client secret error", res.status, detail?.slice(0, 300) ?? "");
    return NextResponse.json({ error: "Pyrius couldn't start a voice session. Please try again.", code: "unavailable" }, { status: 502 });
  }
  const j = (await res.json()) as { value?: string; expires_at?: number; client_secret?: { value?: string; expires_at?: number } };
  const secret = j.value ?? j.client_secret?.value;
  if (!secret) return NextResponse.json({ error: "Pyrius couldn't start a voice session. Please try again.", code: "bad_response" }, { status: 502 });
  return NextResponse.json(
    { client_secret: secret, expires_at: j.expires_at ?? j.client_secret?.expires_at ?? null, model: REALTIME_MODEL(), voice, spoken, max_seconds: MAX_SESSION_SECONDS() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
