import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { API_URL } from "./config";

/**
 * Real photos of places through Pyrius's own server (/api/photo): Pixabay travel photography, then
 * the website's hand-picked photos, then the place's Wikipedia photo. Cached at the edge, then on
 * the phone's disk.
 */

export type PhotoSize = "small" | "medium" | "large";
const WIDTH: Record<PhotoSize, number> = { small: 500, medium: 960, large: 1280 };

/** The address of a place's photo. It answers 404 when the place has no photo. */
export const photoUri = (title: string, size: PhotoSize = "medium", portrait = false, code?: string) =>
  `${API_URL}/api/photo?title=${encodeURIComponent(title)}&w=${WIDTH[size]}${portrait ? "&o=portrait" : ""}${code ? `&code=${code}` : ""}&v=4`;

const credits = new Map<string, string>();

/** Who took the photo ("Name / Pexels" or "Wikimedia Commons"), once known. */
export function usePhotoCredit(title: string | undefined, on: boolean) {
  const [credit, setCredit] = useState(() => (title ? credits.get(title) : undefined));
  useEffect(() => {
    if (!title || !on || credits.has(title)) return;
    let live = true;
    fetch(`${photoUri(title, "small")}&meta=1`)
      .then((r) => (r.ok ? (r.json() as Promise<{ credit?: string }>) : null))
      .then((j) => {
        if (!j?.credit) return;
        credits.set(title, j.credit);
        if (live) setCredit(j.credit);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [title, on]);
  return title ? credits.get(title) ?? credit : undefined;
}

/** Starts downloading photos the user is about to see, so they appear instantly. */
export function prefetchPhotos(titles: string[], size: PhotoSize = "medium", portrait = false) {
  if (!titles.length) return;
  Image.prefetch(titles.map((t) => photoUri(t, size, portrait)), "disk").catch(() => {});
}
