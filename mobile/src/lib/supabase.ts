import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

/** The app's Supabase client: public anon key only; row-level security protects every row. */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: "pkce" },
    })
  : null;

// Refresh the session only while the app is in the foreground (Supabase's recommendation for React Native).
if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export async function accessToken() {
  return (await supabase?.auth.getSession())?.data.session?.access_token ?? null;
}

/** Which sign-in providers are switched on in Supabase; the buttons only appear for these. */
export async function enabledProviders(): Promise<{ google: boolean; apple: boolean }> {
  if (!supabaseConfigured) return { google: false, apple: false };
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
    const j = await r.json();
    return { google: Boolean(j.external?.google), apple: Boolean(j.external?.apple) };
  } catch {
    return { google: false, apple: false };
  }
}
