import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useStore } from "~/lib/store";
import { colors } from "~/lib/theme";
import { Orb } from "./Orb";
import { T } from "./ui";

/** How long the opening bloom plays over the first screen. It never waits on anything, so it can't hold the app. */
const SHOW_FOR = 1500;

/** The opening moment: the orb blooms in with the wordmark, then fades to reveal the screen already open underneath. */
export function LaunchOverlay() {
  const { settings } = useStore();
  const [shown, setShown] = useState(true);
  const bloom = useSharedValue(0);

  useEffect(() => {
    bloom.value = withTiming(1, { duration: 1200, easing: Easing.bezier(0.16, 1, 0.3, 1) });
    const id = setTimeout(() => setShown(false), SHOW_FOR);
    return () => clearTimeout(id);
  }, [bloom]);

  const orbStyle = useAnimatedStyle(() => ({ opacity: bloom.value, transform: [{ scale: 0.82 + bloom.value * 0.18 }] }));

  if (!shown) return null;
  return (
    <Animated.View exiting={FadeOut.duration(350)} style={s.root} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={orbStyle}>
        <Orb mood="idle" sphere={128} theme={settings.orbTheme} />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(400).duration(700)}>
        <T weight="medium" style={s.word}>PYRIUS</T>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: 46 },
  word: { fontSize: 15, letterSpacing: 6.3, color: colors.text2, paddingLeft: 6.3 },
});
