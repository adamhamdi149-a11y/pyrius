import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { usePlacePhoto } from "~/lib/photos";
import { useStore } from "~/lib/store";
import { colors } from "~/lib/theme";
import { T, useAccent } from "./ui";

/**
 * A place's photo filling its box, with a dark gradient for legible text on top. While it loads, or
 * when there's no photo, a gradient in the theme's colours stands in, so the layout never jumps.
 */
export function PlacePhoto({ title, style, children, credit = true, fade = 0.85 }: { title?: string; style?: StyleProp<ViewStyle>; children?: ReactNode; credit?: boolean; fade?: number }) {
  const url = usePlacePhoto(title);
  const accent = useAccent();
  const { L } = useStore();
  return (
    <View style={[s.root, style]}>
      <LinearGradient colors={[accent.deep, colors.surface2, colors.bg2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={350} cachePolicy="disk" accessibilityIgnoresInvertColors /> : null}
      <LinearGradient colors={["rgba(9,10,13,0)", "rgba(9,10,13,0.15)", `rgba(9,10,13,${fade})`]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {children}
      {credit && url ? (
        <T style={s.credit} accessibilityLabel={L("Photo from Wikimedia Commons", "Photo de Wikimedia Commons")}>
          Wikimedia Commons
        </T>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { overflow: "hidden", backgroundColor: colors.surface },
  credit: { position: "absolute", top: 10, right: 12, fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: 0.3 },
});
