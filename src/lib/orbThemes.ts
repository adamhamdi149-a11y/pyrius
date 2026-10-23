/**
 * Orb colour themes. One definition drives both the WebGL orb (shader palette)
 * and the app's accent tokens (src/styles/accents.css, keyed by data-accent).
 */

export type OrbThemeId = "ember" | "arctic" | "violet";

type RGB = [number, number, number];

/** Shader palette slots, in the order the uniform array expects (see orbShader.ts). */
export interface OrbPalette {
  ramp: [RGB, RGB, RGB, RGB, RGB]; // deepest → brightest light inside the glass
  core: RGB; // light from within
  shellTint: RGB; // inner shell lift
  shellEdge: RGB; // inner shell edge glint
  filament: RGB; // energy ridges while thinking
  rim: RGB; // glass rim
  window: RGB; // reflection window
  caustic: RGB; // refraction caustic
  spec: RGB; // specular glint
  ring: RGB; // orbit ring
  satellite: RGB;
  halo: RGB;
  haloListen: RGB;
}

export interface OrbTheme {
  id: OrbThemeId;
  name: string;
  /** Short description for the selector; the name is what users choose by. */
  mood: string;
  palette: OrbPalette;
}

export const ORB_THEMES: OrbTheme[] = [
  {
    id: "ember",
    name: "Blazing Ember",
    mood: "Warm amber light",
    palette: {
      ramp: [
        [0.16, 0.03, 0.005],
        [0.62, 0.15, 0.02],
        [1.0, 0.43, 0.12],
        [1.0, 0.68, 0.4],
        [1.0, 0.93, 0.84],
      ],
      core: [1.0, 0.72, 0.42],
      shellTint: [0.06, 0.03, 0.0],
      shellEdge: [1.0, 0.7, 0.42],
      filament: [1.0, 0.82, 0.6],
      rim: [1.0, 0.55, 0.24],
      window: [1.0, 0.93, 0.86],
      caustic: [1.0, 0.72, 0.45],
      spec: [1.0, 0.97, 0.92],
      ring: [1.0, 0.68, 0.44],
      satellite: [1.0, 0.9, 0.8],
      halo: [1.0, 0.42, 0.12],
      haloListen: [1.0, 0.58, 0.28],
    },
  },
  {
    id: "arctic",
    name: "Arctic Pulse",
    mood: "Electric sapphire light",
    palette: {
      ramp: [
        [0.0, 0.02, 0.11],
        [0.02, 0.13, 0.52],
        [0.09, 0.4, 1.0],
        [0.42, 0.74, 1.0],
        [0.88, 0.96, 1.0],
      ],
      core: [0.5, 0.8, 1.0],
      shellTint: [0.0, 0.03, 0.08],
      shellEdge: [0.5, 0.78, 1.0],
      filament: [0.68, 0.9, 1.0],
      rim: [0.26, 0.6, 1.0],
      window: [0.9, 0.96, 1.0],
      caustic: [0.5, 0.82, 1.0],
      spec: [0.94, 0.98, 1.0],
      ring: [0.52, 0.78, 1.0],
      satellite: [0.86, 0.95, 1.0],
      halo: [0.1, 0.42, 1.0],
      haloListen: [0.3, 0.66, 1.0],
    },
  },
  {
    id: "violet",
    name: "Violet Nova",
    mood: "Rich ultraviolet light",
    palette: {
      ramp: [
        [0.07, 0.0, 0.13],
        [0.3, 0.05, 0.62],
        [0.57, 0.24, 1.0],
        [0.79, 0.57, 1.0],
        [0.97, 0.9, 1.0],
      ],
      core: [0.8, 0.6, 1.0],
      shellTint: [0.04, 0.0, 0.08],
      shellEdge: [0.82, 0.64, 1.0],
      filament: [0.9, 0.76, 1.0],
      rim: [0.66, 0.34, 1.0],
      window: [0.96, 0.92, 1.0],
      caustic: [0.84, 0.62, 1.0],
      spec: [0.98, 0.95, 1.0],
      ring: [0.8, 0.64, 1.0],
      satellite: [0.95, 0.89, 1.0],
      halo: [0.52, 0.2, 1.0],
      haloListen: [0.7, 0.42, 1.0],
    },
  },
];

export const DEFAULT_ORB_THEME: OrbThemeId = "ember";

export const orbThemeById = (id: string | undefined) => ORB_THEMES.find((t) => t.id === id) ?? ORB_THEMES[0];

/** Step through themes with wraparound: Ember → Arctic → Violet → Ember. */
export function stepOrbTheme(id: OrbThemeId, dir: 1 | -1): OrbThemeId {
  const i = ORB_THEMES.findIndex((t) => t.id === id);
  return ORB_THEMES[(i + dir + ORB_THEMES.length) % ORB_THEMES.length].id;
}

/** Flattened palette for the shader's `uniform vec3 uPal[17]`. */
export function paletteArray(p: OrbPalette): Float32Array {
  const slots: RGB[] = [...p.ramp, p.core, p.shellTint, p.shellEdge, p.filament, p.rim, p.window, p.caustic, p.spec, p.ring, p.satellite, p.halo, p.haloListen];
  return new Float32Array(slots.flat());
}

export const PALETTE_SLOTS = 17;
