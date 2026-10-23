"use client";
import { peekPendingPrompt, savePendingPrompt } from "@/lib/pendingPrompt";
import { useStore } from "@/lib/store/AppStore";

export const DRAFT_KEY = "mk:draft";

/**
 * Where "Try Pyrius" leads: straight into the app when signed in (or when accounts
 * aren't configured), otherwise to sign-up, which returns to /app afterwards.
 */
export function useTryHref() {
  const { auth, ready } = useStore();
  const signedIn = ready && (auth.mode === "cloud" || auth.mode === "local");
  return signedIn ? "/app" : "/login?mode=signup&next=%2Fapp";
}

/** Before leaving for sign-up, carry the trip the visitor described (if any). */
export function carryDraft() {
  try {
    const d = sessionStorage.getItem(DRAFT_KEY);
    if (d && !peekPendingPrompt()) savePendingPrompt(d);
  } catch {}
}
