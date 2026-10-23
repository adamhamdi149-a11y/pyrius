"use client";
import { useCallback, useEffect, useState } from "react";

/** `ms` is the measured request time, shown to the user as part of the data-source line. */
type Status<T> = { status: "loading" } | { status: "ok"; data: T; ms?: number } | { status: "error"; error: string };

// Results are deterministic per search, so a session cache avoids refetching on re-render or remount.
const cache = new Map<string, { data: unknown; ms: number }>();

export function useSearch<T>(kind: "flights" | "hotels" | "cars" | "businesses", params: object) {
  const key = `${kind}:${JSON.stringify(params)}`;
  const [state, setState] = useState<Status<T>>(() => (cache.has(key) ? { status: "ok", data: cache.get(key)!.data as T, ms: cache.get(key)!.ms } : { status: "loading" }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache.has(key)) {
      setState({ status: "ok", data: cache.get(key)!.data as T, ms: cache.get(key)!.ms });
      return;
    }
    let alive = true;
    setState({ status: "loading" });
    const started = Date.now();
    fetch(`/api/search/${kind}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: key.slice(kind.length + 1) })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `Search failed (${r.status})`);
        return body as T;
      })
      .then(async (data) => {
        const ms = Date.now() - started;
        // Keep the loading state up briefly so results don't flash in jarringly.
        await new Promise((res) => setTimeout(res, Math.max(0, 650 - ms)));
        cache.set(key, { data, ms });
        if (alive) setState({ status: "ok", data, ms });
      })
      .catch((err: Error) => alive && setState({ status: "error", error: err.message }));
    return () => {
      alive = false;
    };
  }, [key, kind, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry } as Status<T> & { retry: () => void };
}
