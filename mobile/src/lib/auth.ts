import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

/** Where sign-in providers send the user back. Add it to Supabase → Authentication → URL Configuration → Redirect URLs. */
export const AUTH_REDIRECT = Linking.createURL("auth/callback");

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export { isEmail };

function friendly(message: string) {
  if (/rate limit|security purposes|seconds/i.test(message)) return "Too many codes requested. Wait a minute, then try again.";
  if (/expired|invalid/i.test(message)) return "That code didn't work. Check it, or ask for a new one.";
  if (/network|fetch/i.test(message)) return "Can't reach Pyrius. Check your connection and try again.";
  return message;
}

/** Emails a one-time sign-in code; creates the account the first time. */
export async function sendEmailCode(email: string) {
  if (!supabase) throw new Error("Accounts aren't configured in this build.");
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  if (error) throw new Error(friendly(error.message));
}

export async function verifyEmailCode(email: string, token: string) {
  if (!supabase) throw new Error("Accounts aren't configured in this build.");
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: "email" });
  if (error) throw new Error(friendly(error.message));
}

/** Google or Apple through Supabase, in the system's secure browser sheet (PKCE). */
export async function signInWithProvider(provider: "google" | "apple") {
  if (!supabase) throw new Error("Accounts aren't configured in this build.");
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true } });
  if (error || !data.url) throw new Error(friendly(error?.message ?? "Couldn't open sign-in."));
  const res = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
  if (res.type !== "success") return false;
  await completeFromUrl(res.url);
  return true;
}

/** Finishes a provider sign-in from the URL it returned to (also used when the app opens from that link). */
export async function completeFromUrl(url: string) {
  if (!supabase) return;
  const { queryParams } = Linking.parse(url);
  const err = queryParams?.error_description;
  if (typeof err === "string") throw new Error(friendly(err.replace(/\+/g, " ")));
  const code = queryParams?.code;
  if (typeof code === "string") {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error(friendly(error.message));
  }
}
