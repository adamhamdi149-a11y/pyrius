import { orbThemeById, type OrbThemeId } from "@/lib/orbThemes";

/** Pyrius design tokens for the app, mirrored from the web app's src/styles/tokens.css (dark theme). */
export const colors = {
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
} as const;

/** Accent colours follow the selected orb theme (src/styles/accents.css). */
const ACCENTS: Record<OrbThemeId, { accent: string; hi: string; ink: string; glowRgb: string; deep: string }> = {
  ember: { accent: "#ff7628", hi: "#ff9a57", ink: "#1a0b03", glowRgb: "255,118,40", deep: "#7a3a14" },
  arctic: { accent: "#3d8bff", hi: "#7db4ff", ink: "#04112a", glowRgb: "61,139,255", deep: "#173b75" },
  violet: { accent: "#9d6bff", hi: "#c3a0ff", ink: "#13062e", glowRgb: "157,107,255", deep: "#43297a" },
};

export type Accent = (typeof ACCENTS)[OrbThemeId] & { soft: string; line: string };

export function accentFor(id: string | undefined): Accent {
  const a = ACCENTS[orbThemeById(id).id];
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
