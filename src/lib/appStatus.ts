"use client";
import { useEffect, useState } from "react";

/** Which integrations the server has configured (from /api/status), fetched once per page load. */
export interface AppStatus {
  ai: "openai" | "demo";
  supabase: boolean;
  stripe: boolean;
  flights: "live" | "demo" | "none";
  inAppFlights: "test" | "live" | false;
}

let cached: AppStatus | null = null;
let pending: Promise<AppStatus> | null = null;

export function loadStatus(): Promise<AppStatus> {
  pending ??= fetch("/api/status")
    .then((r) => r.json())
    .then((s: AppStatus) => (cached = s))
    .catch((err) => {
      pending = null;
      throw err;
    });
  return pending;
}

/** The status if it has already loaded; click handlers that must decide synchronously use this. */
export const statusNow = () => cached;

export function useAppStatus() {
  const [s, setS] = useState<AppStatus | null>(cached);
  useEffect(() => {
    if (!cached) loadStatus().then(setS, () => undefined);
  }, []);
  return s;
}
