import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useStore } from "~/lib/store";
import { accentFor, colors, fonts, radii } from "~/lib/theme";

export const useAccent = () => accentFor(useStore().settings.orbTheme);

export function tap() {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
}

/** Text in Pyrius's type: Geist, with the weight picked by name. */
export function T({ style, weight = "regular", ...rest }: TextProps & { weight?: "regular" | "medium" | "semibold" | "mono" }) {
  return <Text {...rest} style={[{ fontFamily: fonts[weight], color: colors.text }, style]} />;
}

/** A headline with one expressive serif word, as in the web app ("Just say where."). */
export function Headline({ before, serif, after, size = 38, center, style }: { before?: string; serif: string; after?: string; size?: number; center?: boolean; style?: StyleProp<TextStyle> }) {
  const accent = useAccent();
  return (
    <Text accessibilityRole="header" style={[{ fontFamily: fonts.medium, fontSize: size, lineHeight: size * 1.08, letterSpacing: -size * 0.03, color: colors.text, textAlign: center ? "center" : "left" }, style]}>
      {before ? `${before} ` : ""}
      <Text style={{ fontFamily: fonts.serif, color: accent.hi, letterSpacing: -size * 0.01, fontSize: size * 1.04 }}>{serif}</Text>
      {after ?? ""}
    </Text>
  );
}

/** Fades content up when a screen opens; staggered by `i`. */
export function Rise({ i = 0, children, style }: { i?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.duration(700).delay(120 + i * 90).springify().damping(22)} style={style}>
      {children}
    </Animated.View>
  );
}

export function PrimaryButton({ label, onPress, busy, disabled, style }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const accent = useAccent();
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [s.primary, { backgroundColor: accent.accent, shadowColor: accent.accent, opacity: disabled ? 0.45 : pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}
    >
      {busy ? <ActivityIndicator color={accent.ink} /> : <T weight="semibold" style={{ color: accent.ink, fontSize: 16 }}>{label}</T>}
    </Pressable>
  );
}

export function TextButton({ label, onPress, icon, style, disabled }: { label: string; onPress: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} hitSlop={6} style={({ pressed }) => [s.text, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }, style]}>
      {icon}
      <T weight="medium" style={{ color: colors.text2, fontSize: 15 }}>{label}</T>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, icon, style, disabled, busy }: { label: string; onPress: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [s.outline, { backgroundColor: pressed ? colors.surface : "transparent", opacity: disabled ? 0.45 : 1 }, style]}
    >
      {busy ? <ActivityIndicator color={colors.text2} /> : (
        <>
          {icon}
          <T weight="medium" style={{ fontSize: 15 }}>{label}</T>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ label, onPress, children, style, ...rest }: { label: string; onPress: () => void; children: ReactNode; style?: StyleProp<ViewStyle> } & Omit<PressableProps, "style" | "children">) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [s.icon, { opacity: pressed ? 0.6 : 1 }, style]} {...rest}>
      {children}
    </Pressable>
  );
}

/** Setup progress: a short accent bar for the current step, quieter dots for the rest. */
export function StepDots({ step, total = 5 }: { step: number; total?: number }) {
  const accent = useAccent();
  return (
    <View accessible accessibilityLabel={`Step ${step} of ${total}`} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ width: i + 1 === step ? 18 : 6, height: 3, borderRadius: 3, backgroundColor: i + 1 === step ? accent.accent : i + 1 < step ? accent.deep : colors.border }} />
      ))}
    </View>
  );
}

export function Chip({ label, onPress, selected }: { label: string; onPress: () => void; selected?: boolean }) {
  const accent = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [s.chip, { borderColor: selected ? accent.line : colors.borderSoft, backgroundColor: pressed || selected ? colors.surface : "transparent" }]}
    >
      <T style={{ fontSize: 13, color: selected ? colors.text : colors.text2 }}>{label}</T>
    </Pressable>
  );
}

const s = StyleSheet.create({
  primary: {
    height: 56,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 0,
  },
  text: { height: 52, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  outline: { height: 56, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  icon: { width: 44, height: 44, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center" },
});
