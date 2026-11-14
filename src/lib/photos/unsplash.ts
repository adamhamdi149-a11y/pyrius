import { PhotoUnavailable, type PhotoWidth } from "./wikimedia";

/**
 * Travel photography from Unsplash: high-resolution landscapes, beaches and cities. Needs
 * UNSPLASH_ACCESS_KEY on the server. Unsplash asks apps to load its images from its own CDN
 * (hotlinking) and to credit the photographer, so /api/photo redirects to the image.
 */

type Result = { results?: { width: number; urls?: { raw?: string }; user?: { name?: string } }[] };

/** The best travel photo for a place, or null. Throws PhotoUnavailable. */
export async function unsplashPhoto(place: string, width: PhotoWidth, orientation: "landscape" | "portrait") {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(place)}&orientation=${orientation}&content_filter=high&per_page=5`, {
    headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    signal: AbortSignal.timeout(6000),
  }).catch((e: Error) => {
    throw new PhotoUnavailable(`unsplash: ${e.message}`);
  });
  if (!r.ok) throw new PhotoUnavailable(`unsplash: ${r.status}`);
  const j = (await r.json().catch(() => ({}))) as Result;
  const p = j.results?.find((x) => x.urls?.raw && x.width >= 1200);
  if (!p?.urls?.raw) return null;
  const u = new URL(p.urls.raw);
  if (u.hostname !== "images.unsplash.com") return null;
  u.searchParams.set("w", String(width));
  u.searchParams.set("q", "80");
  u.searchParams.set("fm", "jpg");
  u.searchParams.set("fit", "max");
  return { url: u.toString(), credit: `${p.user?.name ?? "Photographer"} / Unsplash` };
}
