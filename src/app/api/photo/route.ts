import { NextResponse } from "next/server";
import { allow } from "@/lib/ai/concierge/rateLimit";
import { pexelsPhoto } from "@/lib/photos/pexels";
import { cleanTitle, cleanWidth, photoBytes, photoUrl } from "@/lib/photos/wikimedia";

export const runtime = "nodejs";
export const maxDuration = 20;

// Photos rarely change: the CDN keeps each one for 30 days, phones for 7.
const HIT = "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800";
// A place without a photo is checked again the next day.
const MISS = "public, max-age=3600, s-maxage=86400";

/**
 * A photo of a place, served from Pyrius and cached at the edge: GET /api/photo?title=Maldives&w=960
 * (&o=portrait for tall cards, &meta=1 for the photographer's credit as JSON). Pexels travel
 * photography first, then the place's Wikipedia photo (never a flag or a map).
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

  const width = cleanWidth(q.get("w"));
  const orientation = q.get("o") === "portrait" ? "portrait" : "landscape";
  let img: Awaited<ReturnType<typeof photoBytes>> = null;
  let credit = "Wikimedia Commons";
  try {
    // Professional travel photography first; Wikipedia's own photo when Pexels has nothing.
    const pro = await pexelsPhoto(title, width, orientation).catch((e) => (console.error("pexels", (e as Error).message), null));
    if (pro) {
      img = await photoBytes(pro.url);
      credit = pro.credit;
    }
    if (!img) {
      const url = await photoUrl(title, width);
      img = url ? await photoBytes(url) : null;
      credit = "Wikimedia Commons";
    }
  } catch (e) {
    // Wikimedia didn't answer: try again next time instead of remembering "no photo".
    console.error("photo unavailable", title, (e as Error).message);
    return NextResponse.json({ error: "Photo unavailable right now." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  if (!img) return NextResponse.json({ error: "No photo for this place." }, { status: 404, headers: { "Cache-Control": MISS } });
  if (q.get("meta") === "1") return NextResponse.json({ credit }, { headers: { "Cache-Control": HIT } });
  return new Response(img.body, { headers: { "Content-Type": img.type, "Cache-Control": HIT, "X-Photo-Credit": encodeURIComponent(credit) } });
}
