import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "~/lib/theme";
import { T } from "./ui";

type Toast = { id: number; title: string; description?: string; tone?: "info" | "error" | "ok"; action?: { label: string; onPress: () => void } };

let push: ((t: Omit<Toast, "id">) => void) | null = null;

/** Short notices at the top of the screen (saved, errors). Call from anywhere. */
export function toast(t: Omit<Toast, "id">) {
  push?.(t);
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    push = (t) => {
      const id = ++n;
      setItems((l) => [...l.slice(-1), { ...t, id }]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), t.tone === "error" ? 5200 : 3400);
    };
    return () => {
      push = null;
    };
  }, []);
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { paddingTop: insets.top + 8, alignItems: "center" }]}>
      {items.map((t) => (
        <Animated.View key={t.id} entering={FadeInUp.springify().damping(20)} exiting={FadeOutUp.duration(200)} style={s.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <View style={[s.dot, { backgroundColor: t.tone === "error" ? colors.error : t.tone === "ok" ? colors.success : colors.text3 }]} />
          <View style={{ flex: 1 }}>
            <T weight="medium" style={{ fontSize: 14 }}>{t.title}</T>
            {t.description ? <T style={{ fontSize: 13, color: colors.text2, marginTop: 2 }}>{t.description}</T> : null}
          </View>
          {t.action ? (
            <Pressable accessibilityRole="button" onPress={t.action.onPress} hitSlop={8}>
              <T weight="semibold" style={{ fontSize: 13 }}>{t.action.label}</T>
            </Pressable>
          ) : null}
        </Animated.View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  toast: {
    width: "92%",
    maxWidth: 420,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.xl,
    backgroundColor: "rgba(28,29,36,0.96)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
