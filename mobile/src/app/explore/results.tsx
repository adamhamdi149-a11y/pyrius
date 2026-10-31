import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, RotateCcw, Shuffle, SlidersHorizontal } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DESTINATIONS } from "@/lib/explore/destinations";
import { recommend } from "@/lib/explore/engine";
import { DestinationCard } from "~/components/explore/DestinationCard";
import { PersonalityName, pick, TraitChip, useLang } from "~/components/explore/parts";
import { Orb } from "~/components/Orb";
import { IconButton, OutlineButton, PrimaryButton, T, tap } from "~/components/ui";
import { useExplore } from "~/lib/explore";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";

/** The moment between the last answer and the results: the orb thinks while the answers are weighed. */
function Analyzing() {
  const { L, settings } = useStore();
  const lines = [L("Reading your choices…", "Lecture de vos choix…"), L(`Comparing ${DESTINATIONS.length} destinations…`, `Comparaison de ${DESTINATIONS.length} destinations…`), L("Finding your travel style…", "Votre style de voyage se dessine…")];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, lines.length - 1)), 650);
    return () => clearInterval(id);
  }, [lines.length]);
  return (
    <Animated.View exiting={FadeOut.duration(400)} style={[StyleSheet.absoluteFill, s.analyzing]}>
      <Orb mood="thinking" sphere={150} theme={settings.orbTheme} />
      <Animated.View key={i} entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)}>
        <T style={{ fontSize: 16, color: colors.text2 }}>{lines[i]}</T>
      </Animated.View>
    </Animated.View>
  );
}

/** Your travel personality and the destinations that match it, with ways to keep exploring. */
export default function Results() {
  const insets = useSafeAreaInsets();
  const { L } = useStore();
  const lang = useLang();
  const ex = useExplore();
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const [thinking, setThinking] = useState(fresh === "1");
  const [seen, setSeen] = useState<string[]>([]);
  const recs = useMemo(() => recommend(ex.profile, { exclude: seen }), [ex.profile, seen]);

  useEffect(() => {
    if (!thinking) return;
    const id = setTimeout(() => setThinking(false), 2000);
    return () => clearTimeout(id);
  }, [thinking]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/explore"));

  if (!recs.length && !seen.length) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 80, paddingHorizontal: 24, gap: 16 }]}>
        <T weight="semibold" style={{ fontSize: 22 }}>{L("Tell Pyrius a little more", "Dites-en un peu plus à Pyrius")}</T>
        <T style={{ fontSize: 15, lineHeight: 22, color: colors.text2 }}>{L("Answer at least three questions so the recommendations really fit you.", "Répondez à au moins trois questions pour des recommandations vraiment faites pour vous.")}</T>
        <PrimaryButton label={L("Back to the questions", "Revenir aux questions")} onPress={() => router.replace({ pathname: "/explore/play", params: { edit: "1" } })} />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 22 }} showsVerticalScrollIndicator={false}>
        {!thinking ? (
          <>
            <Animated.View entering={FadeInDown.duration(600)} style={{ gap: 12 }}>
              <T weight="semibold" style={s.kicker}>{L("YOUR TRAVEL PERSONALITY", "VOTRE PERSONNALITÉ VOYAGE")}</T>
              <PersonalityName name={pick(ex.personality.name, lang)} size={42} />
              <T style={{ fontSize: 16, lineHeight: 24, color: colors.text2 }}>{pick(ex.personality.description, lang)}</T>
              <View style={s.chips}>
                {ex.traits.map((t) => (
                  <TraitChip key={t.pole} label={pick(t.label, lang)} />
                ))}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(150).duration(600)}>
              <T weight="semibold" style={{ fontSize: 20, letterSpacing: -0.3 }}>{seen.length ? L("More places you'll love", "D'autres lieux pour vous") : L("Destinations you'll love", "Des destinations pour vous")}</T>
            </Animated.View>
            {recs.map((r, i) => (
              <DestinationCard key={r.destination.id} rec={r} index={i} />
            ))}
            {!recs.length ? <T style={{ color: colors.text2, textAlign: "center" }}>{L("That's every place that fits for now.", "C'est tout ce qui vous correspond pour l'instant.")}</T> : null}

            <View style={{ gap: 10, marginTop: 6 }}>
              {recs.length ? (
                <OutlineButton
                  label={L("Show me more places", "Montrez-moi d'autres lieux")}
                  icon={<Shuffle color={colors.text} size={17} />}
                  onPress={() => {
                    tap();
                    setSeen((x) => [...x, ...recs.map((r) => r.destination.id)]);
                  }}
                />
              ) : null}
              <OutlineButton label={L("Change my answers", "Modifier mes réponses")} icon={<SlidersHorizontal color={colors.text} size={17} />} onPress={() => router.replace({ pathname: "/explore/play", params: { edit: "1" } })} />
              <PrimaryButton
                label={L("Discover somewhere new", "Découvrir autre chose")}
                onPress={() => {
                  ex.startOver();
                  router.replace("/explore/play");
                }}
              />
              <T style={{ fontSize: 12, lineHeight: 17, color: colors.text3, textAlign: "center" }}>
                {L("Budgets are categories, not prices. Pyrius shows real fares when you search flights.", "Les budgets sont des catégories, pas des prix. Pyrius affiche les vrais tarifs quand vous cherchez des vols.")}
              </T>
            </View>
          </>
        ) : null}
      </ScrollView>
      {thinking ? <Analyzing /> : null}
      <View style={[s.bar, { top: insets.top + 6 }]} pointerEvents="box-none">
        <IconButton label={L("Back", "Retour")} onPress={back} style={s.round}>
          <ChevronLeft color={colors.text} size={24} strokeWidth={2} />
        </IconButton>
        <IconButton
          label={L("Start over", "Recommencer")}
          onPress={() => {
            ex.startOver();
            router.replace("/explore/play");
          }}
          style={s.round}
        >
          <RotateCcw color={colors.text} size={19} />
        </IconButton>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  analyzing: { backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: 28 },
  kicker: { fontSize: 11, letterSpacing: 1.4, color: colors.text3 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  bar: { position: "absolute", left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" },
  round: { backgroundColor: colors.surface, borderRadius: radii.pill },
});
