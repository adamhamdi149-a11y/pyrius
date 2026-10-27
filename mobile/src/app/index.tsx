import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Orb } from "~/components/Orb";
import { T } from "~/components/ui";
import { useStore } from "~/lib/store";
import { colors } from "~/lib/theme";

/** Splash: the orb blooms in, the wordmark follows, then Pyrius opens where you left off. */
export default function Splash() {
  const { ready, auth, onboarded, settings } = useStore();
  const [shown, setShown] = useState(false);
  const bloom = useSharedValue(0);

  useEffect(() => {
    bloom.value = withTiming(1, { duration: 1400, easing: Easing.bezier(0.16, 1, 0.3, 1) });
    const id = setTimeout(() => setShown(true), 1700);
    return () => clearTimeout(id);
  }, [bloom]);

  useEffect(() => {
    if (!ready || !shown) return;
    if (auth.mode === "signed-out") router.replace("/welcome");
    else if (!onboarded) router.replace(auth.mode === "local" ? "/welcome" : "/alerts");
    else router.replace("/chat");
  }, [ready, shown, auth.mode, onboarded]);

  const orbStyle = useAnimatedStyle(() => ({ opacity: bloom.value, transform: [{ scale: 0.82 + bloom.value * 0.18 }] }));

  return (
    <View style={s.root} accessibilityLabel="Pyrius">
      <Animated.View style={orbStyle}>
        <Orb mood="idle" sphere={128} theme={settings.orbTheme} />
      </Animated.View>
      <Animated.View entering={FadeIn.delay(500).duration(800)}>
        <T weight="medium" style={s.word}>PYRIUS</T>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: 46 },
  word: { fontSize: 15, letterSpacing: 6.3, color: colors.text2, paddingLeft: 6.3 },
});
