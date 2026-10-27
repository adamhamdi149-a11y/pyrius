import { NextResponse } from "next/server";
import { cleanVoice, TTS_MODEL } from "@/lib/ai/voice";
import { gate } from "@/lib/apiGate";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Speaks one Pyrius reply (the take-turns voice mode used where live voice isn't available, such as
 * Expo Go). The text arrives in the body, never the URL, so it stays out of request logs.
 */
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Voice isn't set up on this server yet.", code: "not_configured" }, { status: 503 });
  const g = await gate(req, "speak");
  if (g instanceof NextResponse) return g;
  const body = ((await req.json().catch(() => null)) ?? {}) as { text?: unknown; voice?: unknown };
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 1500) : "";
  if (!text) return NextResponse.json({ error: "Nothing to say.", code: "bad_request" }, { status: 400 });

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model: TTS_MODEL(),
        voice: cleanVoice(body.voice),
        input: text,
        instructions: "A warm, calm and confident travel concierge. Natural pace, friendly, never rushed.",
        response_format: "mp3",
      }),
    });
  } catch {
    return NextResponse.json({ error: "Pyrius couldn't reach its voice service.", code: "unavailable" }, { status: 502 });
  }
  if (!res.ok || !res.body) {
    console.error("OpenAI speech error", res.status);
    return NextResponse.json({ error: "Pyrius couldn't speak that reply.", code: "unavailable" }, { status: res.status === 429 ? 503 : 502 });
  }
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
