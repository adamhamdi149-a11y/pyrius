"use client";
import { useCallback, useEffect, useState } from "react";

type Status<T> = { status: "loading" } | { status: "ok"; data: T } | { status: "error"; error: string };

// Results are deterministic per search, so a session cache avoids refetching on re-render or remount.
const cache = new Map<string, unknown>();

export function useSearch<T>(kind: "flights" | "hotels" | "cars" | "businesses", params: object) {
  const key = `${kind}:${JSON.stringify(params)}`;
  const [state, setState] = useState<Status<T>>(() => (cache.has(key) ? { status: "ok", data: cache.get(key) as T } : { status: "loading" }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache.has(key)) {
      setState({ status: "ok", data: cache.get(key) as T });
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
        // Keep the skeleton up briefly so results don't flash in jarringly.
        const wait = Math.max(0, 450 - (Date.now() - started));
        await new Promise((res) => setTimeout(res, wait));
        cache.set(key, data);
        if (alive) setState({ status: "ok", data });
      })
      .catch((err: Error) => alive && setState({ status: "error", error: err.message }));
    return () => {
      alive = false;
    };
  }, [key, kind, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry } as Status<T> & { retry: () => void };
}
