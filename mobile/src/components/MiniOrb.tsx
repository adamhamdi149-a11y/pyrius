import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import type { OrbThemeId } from "@/lib/orbThemes";

const STOPS: Record<OrbThemeId, [string, string, string, string, string]> = {
  ember: ["#fff1e2", "#ffb47c", "#ff7628", "#c2410c", "#3d1305"],
  arctic: ["#e4f1ff", "#7db4ff", "#2f7bff", "#0b3fb8", "#04123d"],
  violet: ["#f3eaff", "#c3a0ff", "#8f5bff", "#5520c4", "#1d0645"],
};

/** A small static orb for theme swatches and avatars (the live shader is reserved for the big orb). */
export function MiniOrb({ theme, size = 44 }: { theme: OrbThemeId; size?: number }) {
  const c = STOPS[theme];
  const id = `mini-${theme}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" aria-hidden>
      <Defs>
        <RadialGradient id={id} cx="36%" cy="30%" r="78%">
          <Stop offset="0" stopColor={c[0]} />
          <Stop offset="0.2" stopColor={c[1]} />
          <Stop offset="0.54" stopColor={c[2]} />
          <Stop offset="0.86" stopColor={c[3]} />
          <Stop offset="1" stopColor={c[4]} />
        </RadialGradient>
      </Defs>
      <Circle cx="22" cy="22" r="22" fill={`url(#${id})`} />
    </Svg>
  );
}
