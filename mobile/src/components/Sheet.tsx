import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown, useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { Portal, useBackToClose } from "./Overlay";
import { T } from "./ui";

export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * A bottom sheet: dimmed backdrop, rounded top, closes on a backdrop tap or the back button. It sits
 * above the navigation bar and rises with the keyboard, so nothing in it is ever hidden.
 */
type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Takes most of the screen (lists with a search field). */
  tall?: boolean;
  /** The content scrolls when it's taller than the screen. Off for sheets that hold their own list. */
  scroll?: boolean;
};

export function Sheet(props: SheetProps) {
  if (!props.open) return null;
  return (
    <Portal>
      <SheetLayer {...props} />
    </Portal>
  );
}

function SheetLayer({ onClose, title, subtitle, children, tall, scroll = true }: Omit<SheetProps, "open">) {
  const { L } = useStore();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const kb = useAnimatedKeyboard();
  useBackToClose(onClose);
  const lift = useAnimatedStyle(() => ({ paddingBottom: Math.max(insets.bottom + 16, kb.height.value + 16) }));
  return (
    <>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, s.backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={L("Close", "Fermer")} />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(340).easing(EASE_OUT)}
        exiting={SlideOutDown.duration(240).easing(Easing.in(Easing.quad))}
        style={[s.sheet, { maxHeight: height - insets.top - 16 }, tall && { height: Math.min(height * 0.82, height - insets.top - 16) }, lift]}
        accessibilityViewIsModal
      >
        <View style={s.grabber} />
        {title ? (
          <T weight="semibold" style={[s.title, !subtitle && { marginBottom: 18 }]} accessibilityRole="header">
            {title}
          </T>
        ) : null}
        {subtitle ? <T style={s.subtitle}>{subtitle}</T> : null}
        <View style={[{ flexShrink: 1 }, tall && { flex: 1 }, !title && !subtitle && { marginTop: 4 }]}>
          {scroll ? (
            <ScrollView bounces={false} overScrollMode="never" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </View>
      </Animated.View>
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: colors.overlay },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg2,
    borderTopLeftRadius: radii.xxl + 8,
    borderTopRightRadius: radii.xxl + 8,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 18 },
  title: { fontSize: 20, letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.text2, marginBottom: 18 },
});
