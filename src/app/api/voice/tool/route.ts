import { NextResponse } from "next/server";
import { turnStateFor } from "@/lib/ai/concierge";
import { cleanCounts, cleanLocale, cleanPlan, cleanResults, cleanSaved, cleanToday, cleanTrip, oneOf, STAGES } from "@/lib/ai/concierge/clean";
import { runTool } from "@/lib/ai/concierge/tools";
import { isVoiceTool } from "@/lib/ai/voice";
import { gate } from "@/lib/apiGate";
import { placeName } from "@/lib/data/world";
import type { AgentStage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOOL_WINDOWS = [
  { ms: 60_000, max: 30 },
  { ms: 24 * 60 * 60_000, max: 600 },
];

/**
 * Runs one tool call from a voice session. The model asked for it on the app's WebRTC channel;
 * the app forwards it here with the conversation it has on screen. It goes through the same
 * validated tools as the text concierge (real flight search, trip updates, saves), and the result
 * goes back to the model while the app shows the cards and applies the trip changes.
 */
export async function POST(req: Request) {
  const g = await gate(req, "voice-tool", TOOL_WINDOWS);
  if (g instanceof NextResponse) return g;
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (!isVoiceTool(body.name)) return NextResponse.json({ error: "Unknown action", code: "bad_request" }, { status: 400 });
  const args = typeof body.arguments === "string" && body.arguments.length <= 8000 ? body.arguments : null;
  if (args === null) return NextResponse.json({ error: "Invalid arguments", code: "bad_request" }, { status: 400 });

  const locale = cleanLocale(body.locale);
  const stage = oneOf(body.stage, STAGES) ?? "collecting";
  const saved = cleanSaved(body.saved);
  const { state } = await turnStateFor({
    trip: cleanTrip(body.prefs),
    today: cleanToday(body.today),
    locale,
    results: cleanResults(body.results),
    saved,
    plan: cleanPlan(body.plan),
    counts: cleanCounts(body.counts, saved),
  });

  const output = await runTool(body.name, args, state).catch((err) => {
    console.error("Voice tool failed", body.name, (err as Error).message);
    return { ok: false, error: "The travel provider didn't respond. Tell the user to try again in a moment." };
  });

  const t = state.trip;
  const nextStage: AgentStage = state.searched ?? (stage === "collecting" ? "collecting" : stage);
  return NextResponse.json({
    output,
    prefs: t,
    stage: nextStage,
    attachments: state.attachments.length ? state.attachments : undefined,
    actions: state.actions.length ? state.actions : undefined,
    title: t.originCode && t.destinationCode ? `${placeName(t.originCode, locale)} → ${placeName(t.destinationCode, locale)}` : undefined,
  });
}
