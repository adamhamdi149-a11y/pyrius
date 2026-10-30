import type { Href } from "expo-router";
import type { AuthState } from "./store";

/**
 * The app's one map of where a person belongs. The root layout guards every screen with these
 * phases, so a change in sign-in or setup state moves the person on by itself, from any screen.
 *
 *   signed-out  welcome → email → code
 *   setup       alerts → location → light
 *   app         chat (and settings, saved, tracking, voice)
 */
export type Phase = "signed-out" | "setup" | "app";

/** Setup screens in order. Each one's Continue goes to the next; the last one finishes setup. */
export const SETUP_STEPS = ["/alerts", "/location", "/light"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

/** Without accounts configured (local development) there is no sign-in: setup starts from the welcome screen. */
export function phaseOf(auth: AuthState, onboarded: boolean): Phase {
  if (auth.mode === "signed-out") return "signed-out";
  return onboarded ? "app" : "setup";
}

/** A sign-in code that was sent less than this long ago is still worth entering. */
export const PENDING_CODE_MAX_AGE = 60 * 60 * 1000;

export interface PendingCode {
  email: string;
  sentAt: number;
}

/**
 * Where the app opens: the screen for the current phase, or the code screen if a code is on its way.
 * In local mode (no accounts) setup still starts from the welcome screen.
 */
export function startHref(phase: Phase, pending: PendingCode | null, local = false, now = Date.now()): Href {
  if (phase === "app") return "/chat";
  if (phase === "setup") return local ? "/welcome" : "/alerts";
  if (pending && now - pending.sentAt < PENDING_CODE_MAX_AGE) return { pathname: "/code", params: { email: pending.email } };
  return "/welcome";
}

/** The setup screen after this one, or null when this is the last. */
export function nextSetupStep(current: SetupStep): SetupStep | null {
  const i = SETUP_STEPS.indexOf(current);
  return SETUP_STEPS[i + 1] ?? null;
}
