import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/**
 * Real photos of places, from Wikimedia Commons (free to use with credit). A place is named by its
 * English Wikipedia article; its photo is the article's Wikidata image (P18), a single representative
 * photo rather than the collage some city articles open with, with the article's own image as a
 * fallback. Addresses are cached on the phone, so each place is looked up once.
 */

const CACHE_KEY = "pyrius:photos:v1";
const HEADERS = { "Api-User-Agent": "Pyrius/1.0 (https://pyrius.app; contact@pyrius.app)" };
const WIDTH = 1280;

let cache: Record<string, string | null> | null = null;
const inflight = new Map<string, Promise<string | null>>();

async function loadCache() {
  if (cache) return cache;
  try {
    cache = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) ?? "{}");
  } catch {
    cache = {};
  }
  return cache!;
}

function remember(title: string, url: string | null) {
  if (!cache) return;
  cache[title] = url;
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache)).catch(() => {});
}

const filePath = (file: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, "_"))}?width=${WIDTH}`;

async function lookup(title: string): Promise<string | null> {
  const page = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&origin=*&prop=pageprops|pageimages&ppprop=wikibase_item&piprop=thumbnail&pithumbsize=${WIDTH}&titles=${encodeURIComponent(title)}`,
    { headers: HEADERS },
  ).then((r) => r.json() as Promise<{ query?: { pages?: { pageprops?: { wikibase_item?: string }; thumbnail?: { source?: string } }[] } }>);
  const p = page.query?.pages?.[0];
  const qid = p?.pageprops?.wikibase_item;
  if (qid) {
    const claims = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&origin=*&property=P18&entity=${qid}`, { headers: HEADERS })
      .then((r) => r.json() as Promise<{ claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }>)
      .catch(() => null);
    const file = claims?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (file) return filePath(file);
  }
  return p?.thumbnail?.source ?? null;
}

/** The photo address for a place, or null when there's none (or no connection). */
export async function placePhoto(title: string): Promise<string | null> {
  const c = await loadCache();
  if (title in c) return c[title];
  const running = inflight.get(title);
  if (running) return running;
  const job = lookup(title)
    .then((url) => {
      remember(title, url);
      return url;
    })
    // Offline: don't remember the miss, try again next time.
    .catch(() => null)
    .finally(() => inflight.delete(title));
  inflight.set(title, job);
  return job;
}

/** `undefined` while looking it up, then the address or null. */
export function usePlacePhoto(title: string | undefined) {
  const [url, setUrl] = useState<string | null | undefined>(() => (title && cache && title in cache ? cache[title] : undefined));
  useEffect(() => {
    if (!title) return;
    let live = true;
    placePhoto(title).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [title]);
  return title ? url : null;
}
