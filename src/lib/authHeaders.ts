"use client";
import { getSupabase } from "@/lib/supabase/client";

/** The signed-in user's token for API routes that spend paid quota (AI, live searches, booking lookups). */
export async function authHeaders(): Promise<Record<string, string>> {
  const sb = getSupabase();
  if (!sb) return {};
  const token = (await sb.auth.getSession()).data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
