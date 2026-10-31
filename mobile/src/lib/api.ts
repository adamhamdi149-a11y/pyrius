import { fetch } from "expo/fetch";
import { File } from "expo-file-system";
import { API_URL } from "./config";
import { accessToken } from "./supabase";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

const OFFLINE = "Can't reach Pyrius. Check your connection and try again.";

/** A file sent to the server: a local file (recording, photo, document) under a form field name. */
export interface UploadFile {
  field: string;
  uri: string;
  name: string;
  type: string;
}

type Body = { json?: unknown; upload?: { files: UploadFile[]; fields?: Record<string, string> } };

/** Calls the Pyrius server with the signed-in user's token. Errors carry the server's own message. */
export async function api<T>(path: string, body?: unknown, opts: { signal?: AbortSignal } = {}): Promise<T> {
  const res = await send(path, { json: body }, opts.signal);
  return (await res.json()) as T;
}

/** Same as api(), for endpoints that return a file (spoken replies). */
export async function apiRaw(path: string, body?: unknown, opts: { signal?: AbortSignal } = {}) {
  return send(path, { json: body }, opts.signal);
}

/**
 * Sends local files as multipart/form-data. The bytes are read here and the body is built by hand:
 * React Native's own FormData upload of `{ uri }` parts fails on some Android setups with a bare
 * "Network request failed", which said nothing about the real cause.
 */
export async function apiUpload<T>(path: string, files: UploadFile[], fields: Record<string, string> = {}, opts: { signal?: AbortSignal } = {}): Promise<T> {
  const res = await send(path, { upload: { files, fields } }, opts.signal);
  return (await res.json()) as T;
}

const enc = new TextEncoder();

async function multipart(files: UploadFile[], fields: Record<string, string>) {
  const boundary = `----pyrius${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const chunks: Uint8Array[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  for (const f of files) {
    const file = new File(f.uri);
    if (!file.exists || !file.size) throw new ApiError("The file was empty. Please try again.", 0, "empty_file");
    const bytes = await file.bytes();
    chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${f.field}"; filename="${f.name.replace(/"/g, "")}"\r\nContent-Type: ${f.type}\r\n\r\n`));
    chunks.push(bytes);
    chunks.push(enc.encode("\r\n"));
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));
  const body = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    body.set(c, at);
    at += c.length;
  }
  return { body, type: `multipart/form-data; boundary=${boundary}` };
}

async function send(path: string, b: Body, signal?: AbortSignal) {
  const token = await accessToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: string | Uint8Array<ArrayBuffer>;
  if (b.upload) {
    const m = await multipart(b.upload.files, b.upload.fields ?? {});
    headers["Content-Type"] = m.type;
    body = m.body;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(b.json ?? {});
  }
  let res: Awaited<ReturnType<typeof fetch>>;
  try {
    res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body, signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    if (__DEV__) console.warn(`[api] ${path} failed:`, (err as Error).message);
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
    return r.ok ? ((await r.json()) as { ai: "openai" | "demo"; flights: "live" | "demo" | "none" }) : null;
  } catch {
    return null;
  }
}
