import { PhotoUnavailable, type PhotoWidth } from "./wikimedia";

/**
 * Travel photography from Pexels (free to use, credit appreciated): high-resolution landscapes,
 * beaches and cities by professional photographers. Needs PEXELS_API_KEY on the server; without it
 * Pyrius falls back to Wikimedia Commons.
 */

export const pexelsConfigured = () => Boolean(process.env.PEXELS_API_KEY);

type Result = { photos?: { width: number; height: number; photographer?: string; src?: { original?: string } }[] };

/** The best travel photo for a place, sized for `width`, or null when Pexels has none. Throws PhotoUnavailable. */
export async function pexelsPhoto(place: string, width: PhotoWidth, orientation: "landscape" | "portrait") {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(place)}&orientation=${orientation}&size=large&per_page=6`, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(6000),
  }).catch((e: Error) => {
    throw new PhotoUnavailable(`pexels: ${e.message}`);
  });
  if (!r.ok) throw new PhotoUnavailable(`pexels: ${r.status}`);
  const j = (await r.json().catch(() => ({}))) as Result;
  const p = j.photos?.find((x) => x.src?.original && x.width >= 1200);
  if (!p?.src?.original) return null;
  return { url: `${p.src.original}?auto=compress&cs=tinysrgb&w=${width}`, credit: `${p.photographer ?? "Photographer"} / Pexels` };
}
