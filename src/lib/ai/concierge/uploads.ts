import type { UploadKind } from "@/lib/types";

/**
 * Photos and files sent with a chat message (mobile app's + button). They go to the AI with that
 * message only and are never stored by Pyrius. Checked here: type, count and size.
 */

export interface CleanUpload {
  kind: UploadKind;
  name: string;
  type: string;
  /** Base64 contents. */
  data: string;
}

export const MAX_UPLOADS = 4;
/** Base64 characters across a message's files: about 3 MB of files, under the 4.5 MB request limit. */
export const MAX_UPLOAD_CHARS = 4_100_000;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export class UploadProblem extends Error {}

/** Returns the valid uploads, or throws UploadProblem with a message for the user. */
export function cleanUploads(v: unknown): CleanUpload[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new UploadProblem("Those files couldn't be read.");
  if (v.length > MAX_UPLOADS) throw new UploadProblem(`Send up to ${MAX_UPLOADS} files at a time.`);
  let total = 0;
  return v.map((f) => {
    const name = typeof f?.name === "string" ? f.name.replace(/[\r\n"]/g, "").slice(0, 120) || "file" : "file";
    const type = typeof f?.type === "string" ? f.type : "";
    const data = typeof f?.data === "string" ? f.data.replace(/\s/g, "") : "";
    if (!data || !BASE64.test(data)) throw new UploadProblem(`${name} couldn't be read.`);
    total += data.length;
    if (total > MAX_UPLOAD_CHARS) throw new UploadProblem("Those files are too large together. Try fewer or smaller files.");
    if (IMAGE_TYPES.has(type)) return { kind: "image" as const, name, type, data };
    if (type === "application/pdf") return { kind: "pdf" as const, name, type, data };
    if (type === "text/plain") return { kind: "text" as const, name, type, data };
    throw new UploadProblem(`${name}: Pyrius can read photos, PDFs and text files.`);
  });
}

/** The user's turn for the Responses API: their words, then each file as an input part. */
export function userContent(message: string, uploads: CleanUpload[]) {
  if (!uploads.length) return message;
  const note =
    "The user attached the files below to this message. Read them to help with their trip (for example a booking confirmation, a passport page, a screenshot of a flight or a place). " +
    "Only describe what the files actually show. A document is not proof that Pyrius booked anything.";
  return [
    { type: "input_text", text: `${message}\n\n(${note})` },
    ...uploads.map((u) => {
      if (u.kind === "image") return { type: "input_image", image_url: `data:${u.type};base64,${u.data}`, detail: "auto" };
      if (u.kind === "pdf") return { type: "input_file", filename: u.name, file_data: `data:application/pdf;base64,${u.data}` };
      return { type: "input_text", text: `File "${u.name}":\n${Buffer.from(u.data, "base64").toString("utf8").slice(0, 30_000)}` };
    }),
  ];
}
