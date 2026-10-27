import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useAccent } from "./ui";

/** The soft warm light behind the orb (the web app's radial background), tinted by the orb theme. */
export function Glow({ cy = 0.4, strength = 0.07 }: { cy?: number; strength?: number }) {
  const accent = useAccent();
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
      <Defs>
        <RadialGradient id="pyriusGlow" cx="50%" cy={`${cy * 100}%`} rx="75%" ry="45%">
          <Stop offset="0" stopColor={accent.accent} stopOpacity={strength} />
          <Stop offset="1" stopColor={accent.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#pyriusGlow)" />
    </Svg>
  );
}
