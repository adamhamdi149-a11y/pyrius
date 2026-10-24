"use client";
import { useCallback, useEffect, useState } from "react";
import { authHeaders } from "@/lib/authHeaders";

/** `ms` is the measured request time, shown to the user as part of the data-source line. */
type Status<T> = { status: "idle" } | { status: "loading" } | { status: "ok"; data: T; ms?: number } | { status: "error"; error: string; code?: string };

// Results are deterministic per search, so a session cache avoids refetching on re-render or remount.
const cache = new Map<string, { data: unknown; ms: number }>();

/** `enabled: false` skips the request, e.g. when the results already came with the reply. */
export function useSearch<T>(kind: "flights" | "hotels" | "cars" | "businesses", params: object, enabled = true) {
  const key = `${kind}:${JSON.stringify(params)}`;
  const [state, setState] = useState<Status<T>>(() => (!enabled ? { status: "idle" } : cache.has(key) ? { status: "ok", data: cache.get(key)!.data as T, ms: cache.get(key)!.ms } : { status: "loading" }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle" });
      return;
    }
    if (cache.has(key) && attempt === 0) {
      setState({ status: "ok", data: cache.get(key)!.data as T, ms: cache.get(key)!.ms });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    const started = Date.now();
    authHeaders()
      .then((auth) => fetch(`/api/search/${kind}`, { method: "POST", headers: { "Content-Type": "application/json", ...auth }, body: key.slice(kind.length + 1) }))
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(body.error || `Search failed (${r.status})`), { code: body.code as string | undefined });
        return body as T;
      })
      .then(async (data) => {
        const ms = Date.now() - started;
        // Keep the loading state up briefly so results don't flash in jarringly.
        await new Promise((res) => setTimeout(res, Math.max(0, 650 - ms)));
        cache.set(key, { data, ms });
        if (alive) setState({ status: "ok", data, ms });
      })
      .catch((err: Error & { code?: string }) => alive && setState({ status: "error", error: err.message, code: err.code }));
    return () => {
      alive = false;
    };
  }, [key, kind, attempt, enabled]);

  const retry = useCallback(() => {
    cache.delete(key);
    setAttempt((a) => a + 1);
  }, [key]);
  return { ...state, retry } as Status<T> & { retry: () => void };
}
