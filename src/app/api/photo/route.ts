import { NextResponse } from "next/server";
import { allow } from "@/lib/ai/concierge/rateLimit";
import { cleanTitle, cleanWidth, photoBytes, photoUrl } from "@/lib/photos/wikimedia";

export const runtime = "nodejs";
export const maxDuration = 20;

// Photos rarely change: the CDN keeps each one for 30 days, phones for 7.
const HIT = "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800";
// A place without a photo is checked again the next day.
const MISS = "public, max-age=3600, s-maxage=86400";

/**
 * A photo of a place (by English Wikipedia title), served from Pyrius so the apps never depend on
 * how Wikimedia treats phones: GET /api/photo?title=Kyoto&w=960. Public and cached at the edge.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const title = cleanTitle(q.get("title"));
  if (!title) return NextResponse.json({ error: "Unknown place." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ok = allow(`photo:${ip}`, Date.now(), [
    { ms: 60_000, max: 240 },
    { ms: 24 * 60 * 60_000, max: 5000 },
  ]);
  if (!ok.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(ok.retryAfter) } });

  let img: Awaited<ReturnType<typeof photoBytes>> = null;
  try {
    const url = await photoUrl(title, cleanWidth(q.get("w")));
    img = url ? await photoBytes(url) : null;
  } catch (e) {
    // Wikimedia didn't answer: try again next time instead of remembering "no photo".
    console.error("photo unavailable", title, (e as Error).message);
    return NextResponse.json({ error: "Photo unavailable right now." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  if (!img) return NextResponse.json({ error: "No photo for this place." }, { status: 404, headers: { "Cache-Control": MISS } });
  return new Response(img.body, { headers: { "Content-Type": img.type, "Cache-Control": HIT, "X-Photo-Source": "Wikimedia Commons" } });
}
