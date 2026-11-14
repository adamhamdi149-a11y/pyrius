import { Image } from "expo-image";
import { API_URL } from "./config";

/**
 * Real photos of places, from Wikimedia Commons (free to use with credit). A place is named by its
 * English Wikipedia article. Photos come through Pyrius's own server (/api/photo), which looks the
 * photo up, identifies itself to Wikimedia as their policy asks, and caches each one at the edge;
 * the phone then keeps it on disk.
 */

export type PhotoSize = "small" | "medium" | "large";
const WIDTH: Record<PhotoSize, number> = { small: 500, medium: 960, large: 1280 };

/** The address of a place's photo. It answers 404 when the place has no photo. */
export const photoUri = (title: string, size: PhotoSize = "medium") => `${API_URL}/api/photo?title=${encodeURIComponent(title)}&w=${WIDTH[size]}`;

/** Starts downloading photos the user is about to see, so they appear instantly. */
export function prefetchPhotos(titles: string[], size: PhotoSize = "medium") {
  if (!titles.length) return;
  Image.prefetch(titles.map((t) => photoUri(t, size)), "disk").catch(() => {});
}
