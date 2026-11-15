import { PhotoUnavailable, type PhotoWidth } from "./wikimedia";

/**
 * Travel photography from Pixabay (free to use, no attribution required): landscapes, beaches and
 * cities. Needs PIXABAY_API_KEY on the server (free, issued instantly on sign-up). Pixabay asks apps
 * not to hotlink, so Pyrius downloads each photo once and serves it from its own edge cache.
 */

type Result = { hits?: { imageWidth: number; largeImageURL?: string; webformatURL?: string; user?: string; likes?: number }[] };

export async function pixabayPhoto(place: string, width: PhotoWidth, orientation: "landscape" | "portrait") {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return null;
  const qs = new URLSearchParams({
    key,
    q: place.slice(0, 100),
    image_type: "photo",
    orientation: orientation === "portrait" ? "vertical" : "horizontal",
    safesearch: "true",
    order: "popular",
    min_width: "1600",
    per_page: "10",
  });
  const r = await fetch(`https://pixabay.com/api/?${qs}`, { signal: AbortSignal.timeout(6000) }).catch((e: Error) => {
    throw new PhotoUnavailable(`pixabay: ${e.message}`);
  });
  if (!r.ok) throw new PhotoUnavailable(`pixabay: ${r.status}`);
  const j = (await r.json().catch(() => ({}))) as Result;
  // The most-liked of the top results: popular photos are the well-composed ones.
  const best = [...(j.hits ?? [])].slice(0, 6).sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))[0];
  const url = width <= 640 ? best?.webformatURL ?? best?.largeImageURL : best?.largeImageURL;
  if (!url) return null;
  return { url, credit: `${best.user ?? "Photographer"} / Pixabay` };
}
