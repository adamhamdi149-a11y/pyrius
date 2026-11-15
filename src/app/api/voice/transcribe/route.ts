import { NextResponse } from "next/server";
import { TRANSCRIBE_MODEL } from "@/lib/ai/voice";
import { gate } from "@/lib/apiGate";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Dictation for the chat bar's microphone: one short recording in, its text out. The audio goes
 * straight to OpenAI and is not stored by Pyrius.
 */
export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Dictation isn't set up on this server yet.", code: "not_configured" }, { status: 503 });
  const g = await gate(req, "transcribe");
  if (g instanceof NextResponse) return g;

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "No recording received.", code: "bad_request" }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "That recording is too long. Try a shorter message.", code: "too_large" }, { status: 413 });

  const out = new FormData();
  out.append("file", audio, (audio as File).name || "dictation.m4a");
  out.append("model", TRANSCRIBE_MODEL());
  // Names of places and airlines are the hard part; this hint improves them.
  out.append("prompt", "A traveller describing a trip: cities, countries, airports, airlines, dates, numbers of travellers, budgets.");
  const language = form?.get("language");
  if (language === "en" || language === "fr") out.append("language", language);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: out, signal: AbortSignal.timeout(25_000) });
  } catch {
    return NextResponse.json({ error: "Pyrius couldn't reach its speech service. Please try again.", code: "unavailable" }, { status: 502 });
  }
  if (!res.ok) {
    console.error("OpenAI transcription error", res.status);
    return NextResponse.json({ error: "Pyrius couldn't understand that recording. Please try again.", code: "unavailable" }, { status: res.status === 429 ? 503 : 502 });
  }
  const j = (await res.json().catch(() => ({}))) as { text?: string };
  return NextResponse.json({ text: (j.text ?? "").trim().slice(0, 2000) }, { headers: { "Cache-Control": "no-store" } });
}
