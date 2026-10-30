import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { router } from "expo-router";
import { ArrowDown } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Glow } from "~/components/Glow";
import { OnboardingScreen } from "~/components/Onboarding";
import { toast } from "~/components/Toast";
import { Headline, PrimaryButton, Rise, T, TextButton, useAccent } from "~/components/ui";
import { placeName } from "@/lib/data/world";
import { nextSetupStep } from "~/lib/flow";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";

/** Illustration only: what a price-drop notice looks like. Hidden from screen readers. */
function Illustration() {
  const { L, settings } = useStore();
  const accent = useAccent();
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.cubic) }), -1, true);
  }, [drift]);
  const driftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * drift.value }] }));
  const from = settings.homeAirport || "YUL";
  return (
    <View style={s.ill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View entering={FadeInDown.delay(350).duration(900).springify().damping(18)} style={s.notice}>
        <View style={s.noticeIcon}>
          <View style={[s.dotOrb, { backgroundColor: accent.accent, boxShadow: `0 0 10px ${accent.line}` }]} />
        </View>
        <View style={{ flex: 1 }}>
          <T weight="semibold" style={{ fontSize: 13 }}>{L("Price dropped", "Le prix a baissé")}</T>
          <T style={{ fontSize: 13, color: colors.text2 }} numberOfLines={1}>{`${placeName(from, settings.locale)} → ${placeName("LIS", settings.locale)} · $612`}</T>
        </View>
        <T style={{ fontSize: 12, color: colors.text3, alignSelf: "flex-start" }}>{L("now", "maint.")}</T>
      </Animated.View>
      <Animated.View style={[s.fare, driftStyle]}>
        <View style={s.route}>
          <T weight="mono" style={{ fontSize: 15 }}>{from}</T>
          <View style={[s.line, { backgroundColor: accent.accent }]} />
          <T weight="mono" style={{ fontSize: 15 }}>LIS</T>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View style={{ gap: 4 }}>
            <T style={{ fontSize: 13, color: colors.text3, textDecorationLine: "line-through" }}>$696</T>
            <T weight="mono" style={{ fontSize: 34, letterSpacing: -1 }}>$612</T>
          </View>
          <View style={s.drop}>
            <ArrowDown color={colors.success} size={12} strokeWidth={2.6} />
            <T weight="semibold" style={{ fontSize: 13, color: colors.success }}>$84</T>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

export default function Alerts() {
  const { L, settings, updateSettings } = useStore();
  const [busy, setBusy] = useState(false);
  const next = () => router.push(nextSetupStep("/alerts")!);

  const allow = async () => {
    setBusy(true);
    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("price-alerts", { name: L("Price alerts", "Alertes de prix"), importance: AndroidImportance.DEFAULT });
      }
      const { granted } = await Notifications.requestPermissionsAsync();
      updateSettings({ notifications: { ...settings.notifications, priceAlerts: granted } });
      if (!granted) toast({ title: L("Alerts are off", "Alertes désactivées"), description: L("You can turn them on later in Settings.", "Vous pourrez les activer plus tard dans les réglages.") });
    } catch {
      // Not available here (simulator or web); setup continues.
    } finally {
      setBusy(false);
      next();
    }
  };

  return (
    <OnboardingScreen
      step={3}
      background={<Glow cy={0.32} strength={0.06} />}
      footer={
        <Rise i={2} style={{ gap: 10 }}>
          <PrimaryButton label={L("Turn on alerts", "Activer les alertes")} onPress={allow} busy={busy} />
          <TextButton label={L("Not now", "Plus tard")} onPress={next} />
        </Rise>
      }
    >
      <Illustration />
      <View style={{ gap: 12, marginTop: 24, marginBottom: 40 }}>
        <Rise>
          <Headline before={L("Know when it", "Sachez quand ça")} serif={L("drops.", "baisse.")} />
        </Rise>
        <Rise i={1}>
          <T style={{ fontSize: 16, color: colors.text2 }}>{L("Only for prices you track.", "Seulement pour les prix que vous suivez.")}</T>
        </Rise>
      </View>
    </OnboardingScreen>
  );
}

const s = StyleSheet.create({
  ill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 22 },
  notice: { width: 300, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.xl + 2, backgroundColor: "rgba(28,29,36,0.9)", borderWidth: 1, borderColor: colors.border },
  noticeIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.sidebar, alignItems: "center", justifyContent: "center" },
  dotOrb: { width: 18, height: 18, borderRadius: 9 },
  fare: { width: 268, padding: 22, gap: 22, borderRadius: radii.xxl, backgroundColor: "#121318", borderWidth: 1, borderColor: colors.borderSoft },
  route: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  line: { flex: 1, height: 1, marginHorizontal: 12, opacity: 0.7 },
  drop: { height: 28, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: colors.successSoft, flexDirection: "row", alignItems: "center", gap: 4 },
});
