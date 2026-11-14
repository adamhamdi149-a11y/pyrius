import { File, Paths } from "expo-file-system";
import { Appearance, Platform } from "react-native";
import { orbThemeById, type OrbThemeId } from "@/lib/orbThemes";

export type ThemePref = "dark" | "light" | "system";

/** Pyrius design tokens, mirrored from the web app's src/styles/tokens.css. */
const DARK = {
  bg: "#090a0d",
  bg2: "#101116",
  sidebar: "#0c0d11",
  surface: "#16171d",
  surface2: "#1c1d24",
  surface3: "#22232b",
  border: "#262730",
  borderSoft: "#1d1e25",
  borderStrong: "#353642",
  text: "#f5f5f7",
  text2: "#9899a6",
  text3: "#7a7b88",
  success: "#42c98a",
  successSoft: "rgba(66,201,138,0.12)",
  warning: "#f2bc65",
  error: "#f16c72",
  errorSoft: "rgba(241,108,114,0.12)",
  overlay: "rgba(4,5,7,0.66)",
  white: "#ffffff",
  mute: "#e5484d",
};

/** The web app's light theme: warm paper, ink text. */
const LIGHT: typeof DARK = {
  bg: "#f6f5f2",
  bg2: "#fbfaf8",
  sidebar: "#efede9",
  surface: "#ffffff",
  surface2: "#f3f2ee",
  surface3: "#e9e7e2",
  border: "#e4e1db",
  borderSoft: "#ecebe6",
  borderStrong: "#d2cec6",
  text: "#17171b",
  text2: "#5f5e68",
  text3: "#7b7a84",
  success: "#188a56",
  successSoft: "rgba(24,138,86,0.1)",
  warning: "#a86d12",
  error: "#c93a43",
  errorSoft: "rgba(201,58,67,0.09)",
  overlay: "rgba(30,26,20,0.32)",
  white: "#ffffff",
  mute: "#c93a43",
};

/**
 * Light or dark is read once, synchronously, when the app starts: every screen's styles are built
 * from these colours, so a change applies when Pyrius restarts (Settings restarts it for you).
 */
const THEME_FILE = "pyrius-theme.txt";
const isPref = (v: unknown): v is ThemePref => v === "dark" || v === "light" || v === "system";

function readPref(): ThemePref {
  try {
    if (Platform.OS === "web") {
      const v = globalThis.localStorage?.getItem(THEME_FILE);
      return isPref(v) ? v : "dark";
    }
    const f = new File(Paths.document, THEME_FILE);
    const v = f.exists ? f.textSync().trim() : "";
    return isPref(v) ? v : "dark";
  } catch {
    return "dark";
  }
}

export function saveThemePref(p: ThemePref) {
  try {
    if (Platform.OS === "web") return globalThis.localStorage?.setItem(THEME_FILE, p);
    const f = new File(Paths.document, THEME_FILE);
    if (!f.exists) f.create();
    f.write(p);
  } catch {}
}

/** The theme the app started with. */
export const themePref: ThemePref = readPref();
export const scheme: "dark" | "light" = themePref === "system" ? (Appearance.getColorScheme() === "light" ? "light" : "dark") : themePref;
export const colors = scheme === "light" ? LIGHT : DARK;

/** Accent colours follow the selected orb theme (src/styles/accents.css). */
const ACCENTS: Record<OrbThemeId, { accent: string; hi: string; ink: string; glowRgb: string; deep: string }> = {
  ember: { accent: "#ff7628", hi: "#ff9a57", ink: "#1a0b03", glowRgb: "255,118,40", deep: "#7a3a14" },
  arctic: { accent: "#3d8bff", hi: "#7db4ff", ink: "#04112a", glowRgb: "61,139,255", deep: "#173b75" },
  violet: { accent: "#9d6bff", hi: "#c3a0ff", ink: "#13062e", glowRgb: "157,107,255", deep: "#43297a" },
};

export type Accent = (typeof ACCENTS)[OrbThemeId] & { soft: string; line: string };

/** On light paper the accents are deeper, with white text on them (as on the web). */
const LIGHT_ACCENTS: Record<OrbThemeId, { accent: string; hi: string; ink: string; deep: string }> = {
  ember: { accent: "#c84b0a", hi: "#ea5f12", ink: "#ffffff", deep: "#f4cdb3" },
  arctic: { accent: "#1f68e0", hi: "#4d8dff", ink: "#ffffff", deep: "#c4d8fb" },
  violet: { accent: "#7a3ae8", hi: "#9d6bff", ink: "#ffffff", deep: "#dccbfb" },
};

export function accentFor(id: string | undefined): Accent {
  const t = orbThemeById(id).id;
  const a = scheme === "light" ? { ...ACCENTS[t], ...LIGHT_ACCENTS[t] } : ACCENTS[t];
  return { ...a, soft: `rgba(${a.glowRgb},0.12)`, line: `rgba(${a.glowRgb},0.45)` };
}

export const fonts = {
  regular: "Geist_400Regular",
  medium: "Geist_500Medium",
  semibold: "Geist_600SemiBold",
  mono: "GeistMono_500Medium",
  serif: "InstrumentSerif_400Regular_Italic",
} as const;

export const radii = { xs: 8, sm: 10, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999 } as const;

/** Side gutter of every screen. */
export const GUTTER = 24;

/** Text fields draw their own focus state; the browser outline only appears in the web preview. */
export const noOutline = Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : {};
