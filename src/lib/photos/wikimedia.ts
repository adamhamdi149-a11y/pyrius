/**
 * Photos of places from Wikimedia Commons (free to use with credit), looked up by the place's
 * English Wikipedia article. The photo is the article's Wikidata image (P18): one representative
 * photo rather than the collage some city articles open with. The article's own image is the
 * fallback. Wikimedia asks automated clients to identify themselves, so every call sends
 * Pyrius's user agent; apps load the photos through Pyrius (/api/photo), never directly.
 */

const UA = "PyriusBot/1.0 (https://pyrius.app; photos of travel destinations)";
const HEADERS = { "User-Agent": UA, "Api-User-Agent": UA };

/** Thumbnail widths Wikimedia keeps ready-made (others are rendered on demand, slower and rate-limited). */
export const PHOTO_WIDTHS = [500, 960, 1280] as const;
export type PhotoWidth = (typeof PHOTO_WIDTHS)[number];

export const cleanWidth = (v: unknown): PhotoWidth => {
  const n = Number(v);
  return PHOTO_WIDTHS.find((w) => w >= n) ?? 1280;
};

/** A Wikipedia title: letters in any script, digits, spaces and common punctuation; 1 to 120 characters. */
export const cleanTitle = (v: unknown) => {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t.length >= 1 && t.length <= 120 && /^[\p{L}\p{M}\p{N} .,'’()&-]+$/u.test(t) ? t : null;
};

async function json<T>(url: string): Promise<T | null> {
  const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) }).catch((e: Error) => {
    console.error("photo lookup failed", new URL(url).hostname, e.message);
    return null;
  });
  if (r && !r.ok) console.error("photo lookup refused", new URL(url).hostname, r.status);
  if (!r?.ok) return null;
  return (await r.json().catch(() => null)) as T | null;
}

type Pages = { query?: { pages?: { missing?: boolean; pageprops?: { wikibase_item?: string; disambiguation?: string }; thumbnail?: { source?: string } }[] } };
type Claims = { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } };
type FileInfo = { query?: { pages?: { imageinfo?: { thumburl?: string; url?: string; mime?: string }[] }[] } };

/** The image address for a place at about `width` pixels wide, or null when the article has no photo. */
export async function photoUrl(title: string, width: PhotoWidth): Promise<string | null> {
  const page = await json<Pages>(
    `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageprops|pageimages&ppprop=wikibase_item|disambiguation&piprop=thumbnail&pithumbsize=${width}&titles=${encodeURIComponent(title)}`,
  );
  const p = page?.query?.pages?.[0];
  if (!p || p.missing || p.pageprops?.disambiguation !== undefined) return null;
  const qid = p.pageprops?.wikibase_item;
  if (qid && /^Q\d+$/.test(qid)) {
    const claims = await json<Claims>(`https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&property=P18&entity=${qid}`);
    const file = claims?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (file) {
      const info = await json<FileInfo>(
        `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|mime&iiurlwidth=${width}&titles=${encodeURIComponent(`File:${file}`)}`,
      );
      const ii = info?.query?.pages?.[0]?.imageinfo?.[0];
      if (ii && /^image\/(jpeg|png|webp)$/.test(ii.mime ?? "")) return ii.thumburl ?? ii.url ?? null;
    }
  }
  return p.thumbnail?.source ?? null;
}

const MAX_BYTES = 6 * 1024 * 1024;

/** The photo's bytes, or null. Only Wikimedia's own image host is ever fetched. */
export async function photoBytes(url: string): Promise<{ body: ArrayBuffer; type: string } | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== "upload.wikimedia.org") return null;
  const r = await fetch(u, { headers: HEADERS, signal: AbortSignal.timeout(8000) }).catch(() => null);
  const type = r?.headers.get("content-type") ?? "";
  if (!r?.ok || !/^image\/(jpeg|png|webp)/.test(type)) {
    console.error("photo download refused", r?.status ?? "network", type);
    return null;
  }
  const body = await r.arrayBuffer().catch(() => null);
  return body && body.byteLength <= MAX_BYTES ? { body, type } : null;
}
