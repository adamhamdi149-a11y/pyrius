/**
 * Carries the trip a visitor described on the website through sign-up (including an
 * OAuth round-trip) so the app opens with it already in the composer.
 */

const KEY = "pyrius:pending-prompt";
const MAX_AGE_MS = 1000 * 60 * 60 * 24; // a day is plenty to finish signing up

export function savePendingPrompt(text: string) {
  const t = text.trim().slice(0, 600);
  if (!t) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ t, at: Date.now() }));
  } catch {}
}

export function peekPendingPrompt(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { t, at } = JSON.parse(raw) as { t: string; at: number };
    if (!t || Date.now() - at > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

export function takePendingPrompt(): string | null {
  const t = peekPendingPrompt();
  try {
    localStorage.removeItem(KEY);
  } catch {}
  return t;
}

/** Only same-site paths are allowed as post-login destinations. */
export function safeNext(next: string | null | undefined, fallback = "/app") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
