import type { VoiceSettings } from "@/lib/types";

export type VoiceLang = "en" | "fr";

/** The voices the Pyrius server accepts (src/lib/ai/voice), with how each one sounds. Every voice speaks both languages. */
export const VOICE_LIST: { id: string; name: string; en: string; fr: string }[] = [
  { id: "marin", name: "Marin", en: "Warm and natural", fr: "Chaleureuse et naturelle" },
  { id: "cedar", name: "Cedar", en: "Deep and reassuring", fr: "Grave et rassurante" },
  { id: "coral", name: "Coral", en: "Bright and friendly", fr: "Lumineuse et amicale" },
  { id: "shimmer", name: "Shimmer", en: "Light and lively", fr: "Légère et vive" },
  { id: "sage", name: "Sage", en: "Soft and thoughtful", fr: "Douce et posée" },
  { id: "ballad", name: "Ballad", en: "Gentle and melodic", fr: "Douce et mélodieuse" },
  { id: "verse", name: "Verse", en: "Expressive and dynamic", fr: "Expressive et dynamique" },
  { id: "ash", name: "Ash", en: "Clear and steady", fr: "Claire et assurée" },
  { id: "echo", name: "Echo", en: "Calm and resonant", fr: "Calme et posée" },
  { id: "alloy", name: "Alloy", en: "Balanced and neutral", fr: "Équilibrée et neutre" },
];

export const voiceName = (id: string) => VOICE_LIST.find((v) => v.id === id)?.name ?? id;

/** The voice Pyrius speaks with in this language. French falls back to the English choice until one is picked. */
export function voiceFor(voice: VoiceSettings, lang: VoiceLang): string {
  return lang === "fr" ? (voice.voiceFr ?? voice.voice) : voice.voice;
}

/** What each voice says in its preview. */
export const PREVIEW_TEXT: Record<VoiceLang, string> = {
  en: "Hi, I'm Pyrius. Tell me where you'd like to go, and I'll find the flight.",
  fr: "Bonjour, je suis Pyrius. Dites-moi où vous aimeriez partir, et je m'occupe du vol.",
};

const FRENCH_WORDS = /\b(je|vous|nous|le|la|les|des|une|est|pour|avec|dans|sur|pas|vol|vols|voyage|départ|bonjour|merci|oui|à|où|ça)\b/gi;
const ENGLISH_WORDS = /\b(the|you|your|is|are|for|with|and|to|of|flight|flights|trip|hello|thanks|yes|from|what|where)\b/gi;

/** English or French, from the words a reply uses (Pyrius answers in the user's language). */
export function detectLang(text: string, fallback: VoiceLang): VoiceLang {
  const fr = (text.match(FRENCH_WORDS)?.length ?? 0) + (text.match(/[éèêàùçôîœ]/gi)?.length ?? 0) * 0.5;
  const en = text.match(ENGLISH_WORDS)?.length ?? 0;
  if (fr === en) return fallback;
  return fr > en ? "fr" : "en";
}
