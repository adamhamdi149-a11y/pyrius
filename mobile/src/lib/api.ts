import { API_URL } from "./config";
import { accessToken } from "./supabase";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

const OFFLINE = "Can't reach Pyrius. Check your connection and try again.";

/** Calls the Pyrius server with the signed-in user's token. Errors carry the server's own message. */
export async function api<T>(path: string, body?: unknown, opts: { signal?: AbortSignal; form?: FormData } = {}): Promise<T> {
  const res = await send(path, body, opts);
  return (await res.json()) as T;
}

/** Same as api(), for endpoints that return a file (spoken replies). */
export async function apiRaw(path: string, body?: unknown, opts: { signal?: AbortSignal } = {}) {
  return send(path, body, opts);
}

async function send(path: string, body: unknown, opts: { signal?: AbortSignal; form?: FormData }) {
  const token = await accessToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!opts.form) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: opts.form ?? JSON.stringify(body ?? {}), signal: opts.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(OFFLINE, 0, "offline");
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new ApiError(j.error || (res.status === 401 ? "Please sign in again." : "Pyrius couldn't complete that. Please try again."), res.status, j.code);
  }
  return res;
}

export async function getStatus(): Promise<{ ai: "openai" | "demo"; flights: "live" | "demo" | "none" } | null> {
  try {
    const r = await fetch(`${API_URL}/api/status`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
