import { router } from "expo-router";
import { ChevronLeft, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PERSONALITIES } from "@/lib/explore/engine";
import { PersonalityName, pick, SaveButton, useLang } from "~/components/explore/parts";
import { PlacePhoto } from "~/components/PlacePhoto";
import { IconButton, OutlineButton, PrimaryButton, T, tap } from "~/components/ui";
import { useExplore } from "~/lib/explore";
import { placePhoto } from "~/lib/photos";
import { useStore } from "~/lib/store";
import { colors, fonts, radii } from "~/lib/theme";

/** Places the welcome screen drifts through: a hint of how different the answers can be. */
const BACKDROPS = ["Fushimi Inari-taisha", "Moraine Lake", "Santorini", "Jemaa el-Fnaa", "Lofoten"];

/** The welcome: big, slow-changing photography and one invitation. */
function Welcome({ onStart }: { onStart: () => void }) {
  const { L } = useStore();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [i, setI] = useState(0);
  useEffect(() => {
    BACKDROPS.forEach((t) => void placePhoto(t));
    const id = setInterval(() => setI((x) => (x + 1) % BACKDROPS.length), 4200);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <Animated.View key={BACKDROPS[i]} entering={FadeIn.duration(1100)} exiting={FadeOut.duration(1100)} style={StyleSheet.absoluteFill}>
        <PlacePhoto title={BACKDROPS[i]} style={StyleSheet.absoluteFill} fade={0.96} credit={false} />
      </Animated.View>
      <View style={[s.welcome, { paddingBottom: insets.bottom + 28, minHeight: height }]}>
        <Animated.View entering={FadeInDown.delay(200).duration(700)} style={s.badge}>
          <Sparkles color={colors.white} size={14} />
          <T weight="semibold" style={{ fontSize: 12, letterSpacing: 1.2, color: colors.white }}>PYRIUS EXPLORE</T>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(350).duration(800)}>
          <T style={s.title} accessibilityRole="header">
            {L("Discover your ", "Découvrez votre ")}
            <T style={s.serif}>{L("travel style.", "style de voyage.")}</T>
          </T>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(500).duration(800)}>
          <T style={s.sub}>{L("A few choices are all it takes for Pyrius to discover the destinations you'll love.", "Quelques choix suffisent pour que Pyrius découvre les destinations que vous allez adorer.")}</T>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(700).duration(800)} style={{ alignSelf: "stretch", gap: 10 }}>
          <PrimaryButton label={L("Let's discover", "C'est parti")} onPress={onStart} />
          <T style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>{L("12 quick choices · about a minute", "12 choix rapides · environ une minute")}</T>
        </Animated.View>
      </View>
    </View>
  );
}

/** Explore's home: the welcome the first time, then your travel personality, saved places and a way to start again. */
export default function ExploreHome() {
  const insets = useSafeAreaInsets();
  const { L } = useStore();
  const lang = useLang();
  const ex = useExplore();
  const last = ex.history[0];
  const saved = ex.savedDestinations();

  const startOver = () => {
    tap();
    ex.startOver();
    router.push("/explore/play");
  };

  const back = (
    <View style={[s.bar, { top: insets.top + 6 }]} pointerEvents="box-none">
      <IconButton label={L("Back", "Retour")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/chat"))} style={s.round}>
        <ChevronLeft color={colors.white} size={24} strokeWidth={2} />
      </IconButton>
    </View>
  );

  if (!last) {
    return (
      <View style={s.root}>
        <Welcome onStart={startOver} />
        {back}
      </View>
    );
  }

  const personality = PERSONALITIES.find((p) => p.id === last.personality) ?? ex.personality;
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 64, paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 26 }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(500)} style={s.card}>
          <T weight="semibold" style={s.kicker}>{L("YOUR TRAVEL PERSONALITY", "VOTRE PERSONNALITÉ VOYAGE")}</T>
          <PersonalityName name={pick(personality.name, lang)} size={36} />
          <T style={{ fontSize: 15, lineHeight: 22, color: colors.text2 }}>{pick(personality.description, lang)}</T>
          <PrimaryButton label={L("See my destinations", "Voir mes destinations")} onPress={() => router.push("/explore/results")} style={{ marginTop: 8 }} />
        </Animated.View>

        <View style={{ gap: 10 }}>
          <OutlineButton label={L("Discover somewhere new", "Découvrir autre chose")} icon={<RotateCcw color={colors.text} size={17} />} onPress={startOver} />
          <OutlineButton label={L("Change my answers", "Modifier mes réponses")} icon={<SlidersHorizontal color={colors.text} size={17} />} onPress={() => router.push({ pathname: "/explore/play", params: { edit: "1" } })} />
        </View>

        {saved.length ? (
          <View style={{ gap: 12 }}>
            <T weight="semibold" style={{ fontSize: 18 }}>{L("Saved places", "Lieux enregistrés")}</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {saved.map((d) => (
                <Pressable key={d.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/explore/[id]", params: { id: d.id } })}>
                  <PlacePhoto title={d.photo} style={s.mini} credit={false}>
                    <View style={{ position: "absolute", top: 8, right: 8 }}>
                      <SaveButton saved onPress={() => ex.toggleSaved(d.id)} light />
                    </View>
                    <View style={{ position: "absolute", left: 12, bottom: 12, right: 12 }}>
                      <T weight="semibold" style={{ fontSize: 17, color: colors.white }} numberOfLines={1}>{pick(d.name, lang)}</T>
                      <T style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }} numberOfLines={1}>{pick(d.country, lang)}</T>
                    </View>
                  </PlacePhoto>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {ex.history.length > 1 ? (
          <View style={{ gap: 8 }}>
            <T weight="semibold" style={{ fontSize: 18 }}>{L("Your past discoveries", "Vos découvertes passées")}</T>
            {ex.history.slice(1, 6).map((h) => {
              const p = PERSONALITIES.find((x) => x.id === h.personality);
              return p ? (
                <View key={h.at} style={s.past}>
                  <T weight="medium" style={{ fontSize: 15, flex: 1 }}>{pick(p.name, lang)}</T>
                  <T style={{ fontSize: 12, color: colors.text3 }}>{h.at.slice(0, 10)}</T>
                </View>
              ) : null;
            })}
          </View>
        ) : null}
      </ScrollView>
      {back}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar: { position: "absolute", left: 12, right: 12, flexDirection: "row" },
  round: { backgroundColor: "rgba(9,10,13,0.5)", borderRadius: radii.pill },
  welcome: { flex: 1, justifyContent: "flex-end", alignItems: "flex-start", paddingHorizontal: 24, gap: 18 },
  badge: { flexDirection: "row", alignItems: "center", gap: 8, height: 30, paddingHorizontal: 12, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  title: { fontFamily: fonts.medium, fontSize: 46, lineHeight: 50, letterSpacing: -1.4, color: colors.white },
  serif: { fontFamily: fonts.serif, fontSize: 49, color: colors.white },
  sub: { fontSize: 17, lineHeight: 25, color: "rgba(255,255,255,0.82)" },
  card: { gap: 12, padding: 22, borderRadius: radii.xxl + 4, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft },
  kicker: { fontSize: 11, letterSpacing: 1.4, color: colors.text3 },
  mini: { width: 170, height: 220, borderRadius: radii.xl },
  past: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: radii.lg, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft },
});
