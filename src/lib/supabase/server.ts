import type { PlanId } from "@/lib/types";

/** Minimal server helpers that call Supabase's REST endpoints. Secrets never leave the server. */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function getUserFromRequest(req: Request): Promise<{ id: string; email?: string } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!URL || !ANON || !token) return null;
  const res = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = await res.json();
  return { id: user.id, email: user.email };
}

export async function upsertSubscription(row: {
  user_id: string;
  plan: PlanId;
  status: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
}) {
  if (!URL || !SERVICE) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to write subscriptions");
  const res = await fetch(`${URL}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: "POST",
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase upsert failed: ${res.status} ${await res.text()}`);
}

export async function downgradeBySubscriptionId(subscriptionId: string) {
  if (!URL || !SERVICE) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to write subscriptions");
  const res = await fetch(`${URL}/rest/v1/subscriptions?stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}`, {
    method: "PATCH",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "free", status: "canceled", updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase update failed: ${res.status}`);
}

/** The user's billing row (server only, via the service role). */
export async function getSubscriptionRow(userId: string): Promise<{ plan: PlanId; status: string; stripe_customer_id: string | null; stripe_subscription_id: string | null } | null> {
  if (!URL || !SERVICE) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to read subscriptions");
  const res = await fetch(`${URL}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=plan,status,stripe_customer_id,stripe_subscription_id`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  if (!res.ok) throw new Error(`Supabase read failed: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}
