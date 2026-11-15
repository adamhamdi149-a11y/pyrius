/** Public configuration, built into the app from EXPO_PUBLIC_* variables (see .env.example). No secrets here. */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://pyrius.app").replace(/\/$/, "");
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
