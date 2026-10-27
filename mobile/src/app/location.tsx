import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming, ZoomIn } from "react-native-reanimated";
import { AirportPicker } from "~/components/AirportPicker";
import { OnboardingScreen } from "~/components/Onboarding";
import { toast } from "~/components/Toast";
import { Headline, PrimaryButton, Rise, T, TextButton, useAccent } from "~/components/ui";
import { findAirport, nearestAirport } from "@/lib/data/world";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";

function Ping({ delay }: { delay: number }) {
  const accent = useAccent();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3200, easing: Easing.out(Easing.cubic) }), -1, false));
  }, [p, delay]);
  const st = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - p.value), transform: [{ scale: 0.35 + p.value * 0.65 }] }));
  return <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 150, borderWidth: 1.5, borderColor: accent.line }, st]} />;
}

/** Radar illustration around the home airport the app has found (or the default). */
function Radar({ code }: { code: string }) {
  const accent = useAccent();
  const a = findAirport(code);
  return (
    <View style={s.radarWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={s.radar}>
        <View style={[s.ring, { inset: 0 }]} />
        <View style={[s.ring, { inset: 50 }]} />
        <View style={[s.ring, { inset: 100, borderStyle: "dashed", borderColor: colors.border }]} />
        <Ping delay={0} />
        <Ping delay={1600} />
        <View style={[s.blip, { left: 46, top: 74 }]} />
        <View style={[s.blip, { right: 40, top: 120 }]} />
        <View style={[s.blip, { left: 92, bottom: 52 }]} />
        <View style={[s.center, { backgroundColor: accent.accent, boxShadow: `0 0 0 6px ${accent.soft}, 0 0 30px ${accent.line}` }]} />
        <Animated.View key={code} entering={ZoomIn.springify().damping(16)} style={s.chipWrap}>
          <View style={s.chip}>
            <T weight="mono" style={{ fontSize: 13, color: accent.hi }}>{code}</T>
            <T style={{ fontSize: 13, color: colors.text2 }}>{a?.city ?? ""}</T>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

export default function LocationScreen() {
  const { L, settings, updateSettings } = useStore();
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const next = () => router.push("/light");

  const choose = (code: string) => {
    updateSettings({ homeAirport: code });
    setFound(code);
    setTimeout(next, 900);
  };

  const useLocation = async () => {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        toast({ title: L("Location is off", "Localisation désactivée"), description: L("Pick your airport instead.", "Choisissez plutôt votre aéroport.") });
        setPicking(true);
        return;
      }
      // A coarse, one-time position is enough to find the nearest airport.
      const pos = (await Location.getLastKnownPositionAsync({ maxAge: 3_600_000 })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
      const a = nearestAirport(pos.coords.latitude, pos.coords.longitude);
      if (a) choose(a.code);
      else setPicking(true);
    } catch {
      toast({ tone: "error", title: L("Couldn't find your location", "Position introuvable"), description: L("Pick your airport instead.", "Choisissez plutôt votre aéroport.") });
      setPicking(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingScreen
      step={4}
      footer={
        <Rise i={2} style={{ gap: 10 }}>
          <PrimaryButton label={found ? L("Continue", "Continuer") : L("Use my location", "Utiliser ma position")} onPress={found ? next : useLocation} busy={busy} />
          <TextButton label={L("Choose myself", "Choisir moi-même")} onPress={() => setPicking(true)} />
        </Rise>
      }
    >
      <Radar code={found ?? settings.homeAirport ?? "YUL"} />
      <View style={{ gap: 12, marginTop: 24, marginBottom: 40 }}>
        <Rise>
          <Headline before={L("Fly from", "Partez de")} serif={L("nearby.", "près.")} />
        </Rise>
        <Rise i={1}>
          {found ? (
            <Animated.View entering={FadeIn}>
              <T style={{ fontSize: 16, color: colors.text2 }}>{L(`Home airport: ${findAirport(found)?.city}.`, `Aéroport de départ : ${findAirport(found)?.city}.`)}</T>
            </Animated.View>
          ) : (
            <T style={{ fontSize: 16, color: colors.text2 }}>{L("We'll set your home airport.", "Nous choisirons votre aéroport.")}</T>
          )}
        </Rise>
      </View>
      <AirportPicker
        open={picking}
        onClose={() => setPicking(false)}
        title={L("Your home airport", "Votre aéroport")}
        onPick={(a) => {
          setPicking(false);
          choose(a.code);
        }}
      />
    </OnboardingScreen>
  );
}

const s = StyleSheet.create({
  radarWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  radar: { width: 300, height: 300 },
  ring: { position: "absolute", borderRadius: 150, borderWidth: 1, borderColor: colors.borderSoft },
  blip: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  center: { position: "absolute", left: 139, top: 139, width: 22, height: 22, borderRadius: 11 },
  chipWrap: { position: "absolute", top: 180, left: 0, right: 0, alignItems: "center" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: "rgba(28,29,36,0.9)", borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 },
});
