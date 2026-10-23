"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/** Browser client using the public anon key only. Row-level security protects all user data. */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anon) return null;
  client ??= createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

export const supabaseConfigured = Boolean(url && anon);
