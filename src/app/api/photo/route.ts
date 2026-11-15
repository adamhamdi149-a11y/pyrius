import { NextResponse } from "next/server";
import { allow } from "@/lib/ai/concierge/rateLimit";
import { curatedPhoto } from "@/lib/photos/curated";
import { pexelsPhoto } from "@/lib/photos/pexels";
import { pixabayPhoto } from "@/lib/photos/pixabay";
import { unsplashPhoto } from "@/lib/photos/unsplash";
import { cleanTitle, cleanWidth, photoBytes, photoUrl } from "@/lib/photos/wikimedia";

export const runtime = "nodejs";
export const maxDuration = 20;

// Photos rarely change: the CDN keeps each one for 30 days, phones for 7.
const HIT = "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800";
// A place without a photo is checked again the next day.
const MISS = "public, max-age=3600, s-maxage=86400";

/**
 * A photo of a place, served or redirected by Pyrius and cached at the edge: GET /api/photo?title=Maldives&w=960
 * (&code=LIS to use an airport's city, &o=portrait for tall cards, &meta=1 for the credit as JSON).
 * Order: Pixabay, then the website's hand-picked photos, Unsplash or Pexels (whichever has a key),
 * then the place's Wikipedia photo (never a flag or a map).
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
  const meta = q.get("meta") === "1";
  const redirect = (url: string, by: string) =>
    meta ? NextResponse.json({ credit: by }, { headers: { "Cache-Control": HIT } }) : new Response(null, { status: 302, headers: { Location: url, "Cache-Control": HIT } });
  try {
    // Pixabay first: high-resolution travel photography for every destination.
    const pix = await pixabayPhoto(title, width, orientation).catch((e) => (console.error("pixabay", (e as Error).message), null));
    if (pix) {
      img = await photoBytes(pix.url).catch(() => null);
      credit = pix.credit;
    }
    if (!img) {
      // The website's hand-picked photos, then Unsplash or Pexels when they have a key.
      const code = q.get("code")?.toUpperCase().match(/^[A-Z]{3}$/)?.[0] ?? null;
      const picked = curatedPhoto(title, code, width);
      if (picked) return redirect(picked, "Unsplash");
      const best = await unsplashPhoto(title, width, orientation).catch((e) => (console.error("unsplash", (e as Error).message), null));
      if (best) return redirect(best.url, best.credit);
      const pex = await pexelsPhoto(title, width, orientation).catch((e) => (console.error("pexels", (e as Error).message), null));
      if (pex) {
        img = await photoBytes(pex.url);
        credit = pex.credit;
      }
    }
    if (!img) {
      // Last resort: the place's own Wikipedia photo (never a flag or a map).
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
  if (meta) return NextResponse.json({ credit }, { headers: { "Cache-Control": HIT } });
  return new Response(img.body, { headers: { "Content-Type": img.type, "Cache-Control": HIT, "X-Photo-Credit": encodeURIComponent(credit) } });
}
