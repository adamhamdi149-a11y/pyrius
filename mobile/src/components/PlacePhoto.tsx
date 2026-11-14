import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { photoUri, usePhotoCredit, type PhotoSize } from "~/lib/photos";
import { useStore } from "~/lib/store";
import { colors } from "~/lib/theme";
import { T, useAccent } from "./ui";

/**
 * A place's photo filling its box, with a dark gradient for legible text on top. While it loads, or
 * when there's no photo, a gradient in the theme's colours stands in, so the layout never jumps.
 */
export function PlacePhoto({
  title,
  style,
  children,
  credit = true,
  fade = 0.85,
  size = "medium",
  portrait = false,
  code,
}: {
  title?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  credit?: boolean;
  fade?: number;
  size?: PhotoSize;
  /** A tall box: asks for a tall photo. */
  portrait?: boolean;
  /** The airport of the place, when known: its city's photo from the website. */
  code?: string;
}) {
  const accent = useAccent();
  const { L } = useStore();
  const [shown, setShown] = useState<string | null>(null);
  const uri = title ? photoUri(title, size, portrait, code) : null;
  const by = usePhotoCredit(title, credit && shown === uri);
  return (
    <View style={[s.root, style]}>
      <LinearGradient colors={[accent.deep, colors.surface2, colors.bg2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={400}
          cachePolicy="disk"
          recyclingKey={uri}
          onLoad={() => setShown(uri)}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <LinearGradient colors={["rgba(9,10,13,0)", "rgba(9,10,13,0.15)", `rgba(9,10,13,${fade})`]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {children}
      {credit && shown === uri && by ? (
        <T style={s.credit} accessibilityLabel={L(`Photo: ${by}`, `Photo : ${by}`)}>
          {by}
        </T>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { overflow: "hidden", backgroundColor: colors.surface },
  credit: { position: "absolute", bottom: 8, right: 12, fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 0.3 },
});
