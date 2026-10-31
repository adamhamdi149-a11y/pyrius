import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import type { UploadKind } from "@/lib/types";

/**
 * Photos and files the user adds to a message with the chat bar's + button. Photos are resized and
 * compressed on the phone (a travel document stays readable at 1600 px), so a message with a few
 * attachments stays well under the server's request limit.
 */

export interface PendingUpload {
  id: string;
  kind: UploadKind;
  name: string;
  /** MIME type sent to the server. */
  type: string;
  /** Local copy, for the thumbnail in the chat. */
  uri: string;
  /** File contents, base64. */
  data: string;
  size: number;
}

export const MAX_UPLOADS = 4;
const MAX_IMAGE_SIDE = 1600;
/** Base64 is a third bigger than the file; the server accepts about 4 MB per message. */
export const MAX_TOTAL_BYTES = 3_000_000;
const MAX_TEXT_BYTES = 200_000;

const TEXT_TYPES = ["text/plain", "text/csv", "text/markdown", "text/x-markdown"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];

export class UploadError extends Error {}

/** A local file as base64 (on the web, picked files are blob URLs the file system can't open). */
async function readBase64(uri: string): Promise<string> {
  if (Platform.OS !== "web") return new File(uri).base64();
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const uid = () => `up_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

async function fromImage(uri: string, name: string): Promise<PendingUpload> {
  const ref = await ImageManipulator.manipulate(uri, { maxWidth: MAX_IMAGE_SIDE, maxHeight: MAX_IMAGE_SIDE }).renderAsync();
  const out = await ref.saveAsync({ compress: 0.72, format: SaveFormat.JPEG, base64: true });
  if (!out.base64) throw new UploadError("This photo couldn't be read.");
  const base = name.replace(/\.[^.]+$/, "") || "photo";
  return { id: uid(), kind: "image", name: `${base}.jpg`, type: "image/jpeg", uri: out.uri, data: out.base64, size: Math.round((out.base64.length * 3) / 4) };
}

async function fromFile(asset: DocumentPicker.DocumentPickerAsset): Promise<PendingUpload> {
  const type = asset.mimeType ?? "";
  const lower = asset.name.toLowerCase();
  if (IMAGE_TYPES.includes(type) || /\.(jpe?g|png|webp|heic|heif|gif)$/.test(lower)) return fromImage(asset.uri, asset.name);
  const isPdf = type === "application/pdf" || lower.endsWith(".pdf");
  const isText = TEXT_TYPES.includes(type) || /\.(txt|csv|md)$/.test(lower);
  if (!isPdf && !isText) throw new UploadError("Pyrius can read photos, PDFs and text files.");
  const size = asset.size ?? (Platform.OS === "web" ? 0 : new File(asset.uri).size) ?? 0;
  if (isText && size > MAX_TEXT_BYTES) throw new UploadError("That text file is too long.");
  if (size > MAX_TOTAL_BYTES) throw new UploadError("That file is too large. Files up to 3 MB work.");
  const data = await readBase64(asset.uri);
  return { id: uid(), kind: isPdf ? "pdf" : "text", name: asset.name, type: isPdf ? "application/pdf" : "text/plain", uri: asset.uri, data, size };
}

/** Takes a photo with the camera. Null when the user cancels; throws with a message to show otherwise. */
export async function takePhoto(): Promise<PendingUpload | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new UploadError("camera-permission");
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9 });
  if (res.canceled || !res.assets[0]) return null;
  return fromImage(res.assets[0].uri, res.assets[0].fileName ?? "photo.jpg");
}

/** Picks photos from the library (the system picker needs no permission on recent Android and iOS). */
export async function pickPhotos(limit: number): Promise<PendingUpload[]> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: limit > 1, selectionLimit: limit, quality: 0.9 });
  if (res.canceled) return [];
  return Promise.all(res.assets.slice(0, limit).map((a) => fromImage(a.uri, a.fileName ?? "photo.jpg")));
}

/** Picks PDFs, text files or images from the phone's files. */
export async function pickFiles(limit: number): Promise<PendingUpload[]> {
  const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*", ...TEXT_TYPES], multiple: limit > 1, copyToCacheDirectory: true });
  if (res.canceled) return [];
  return Promise.all(res.assets.slice(0, limit).map(fromFile));
}

/** What a message's attachments add up to, for the size limit. */
export const totalSize = (list: PendingUpload[]) => list.reduce((n, u) => n + u.size, 0);
