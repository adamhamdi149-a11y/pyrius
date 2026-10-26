import type { AnyOffer, PriceTracker, SavedOffer, UserSettings } from "@/lib/types";

/**
 * Service-role access for scheduled jobs (price checks). Server only: it bypasses row-level
 * security, so every query names the user it acts for.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const adminConfigured = () => Boolean(URL && SERVICE);

async function rest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!URL || !SERVICE) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for scheduled jobs");
  const res = await fetch(`${URL}${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${init.method ?? "GET"} ${path.split("?")[0]} failed: ${res.status}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

const eq = (v: string) => `eq.${encodeURIComponent(v)}`;

/** Trackers that may be due for a check, least recently checked first. */
export async function listCheckableTrackers(limit = 300) {
  return rest<{ user_id: string; data: PriceTracker }[]>(
    `/rest/v1/price_trackers?select=user_id,data&status=in.(active,target-reached,unavailable)&order=last_checked_at.asc.nullsfirst&limit=${limit}`,
  );
}

export async function getSavedOffer(userId: string, offerId: string): Promise<AnyOffer | null> {
  const rows = await rest<{ data: SavedOffer }[]>(`/rest/v1/saved_offers?select=data&user_id=${eq(userId)}&id=${eq(offerId)}&limit=1`);
  return rows[0]?.data.data ?? null;
}

export async function updateTracker(userId: string, t: PriceTracker) {
  await rest(`/rest/v1/price_trackers?user_id=${eq(userId)}&id=${eq(t.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_known_price: t.lastKnownPrice, last_checked_at: t.lastCheckedAt, status: t.status, data: t }),
  });
}

export async function getUserSettings(userId: string): Promise<Partial<UserSettings> | null> {
  const rows = await rest<{ data: Partial<UserSettings> }[]>(`/rest/v1/user_settings?select=data&user_id=${eq(userId)}&limit=1`);
  return rows[0]?.data ?? null;
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const user = await rest<{ email?: string }>(`/auth/v1/admin/users/${encodeURIComponent(userId)}`);
  return user.email ?? null;
}

export async function getPlan(userId: string): Promise<string> {
  const rows = await rest<{ plan: string; status: string }[]>(`/rest/v1/subscriptions?select=plan,status&user_id=${eq(userId)}&limit=1`);
  return rows[0] && rows[0].status !== "canceled" ? rows[0].plan : "free";
}
