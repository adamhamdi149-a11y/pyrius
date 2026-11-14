import { router, useLocalSearchParams } from "expo-router";
import { CalendarDays, ChevronLeft, Luggage, MessageCircle, PlaneLanding, Wallet } from "lucide-react-native";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { airportLabel } from "@/lib/data/world";
import { destinationById } from "@/lib/explore/destinations";
import { bestSeason, BUDGET_LABELS, budgetSymbol, matchScore, MIN_ANSWERS, reasonsFor } from "@/lib/explore/engine";
import { poleOf, type Trait } from "@/lib/explore/traits";
import { flightsTo } from "~/components/explore/DestinationCard";
import { pick, SaveButton, TraitChip, useLang } from "~/components/explore/parts";
import { PlacePhoto } from "~/components/PlacePhoto";
import { IconButton, OutlineButton, PrimaryButton, T, useAccent } from "~/components/ui";
import { useExplore } from "~/lib/explore";
import { askPyrius } from "~/lib/handoff";
import { useStore } from "~/lib/store";
import { colors, fonts, radii } from "~/lib/theme";
import { useTrips } from "~/lib/trips";

function Fact({ icon, label, value, last }: { icon: ReactNode; label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.fact, !last && s.factLine]}>
      {icon}
      <T style={{ flex: 1, fontSize: 15, color: colors.text2 }}>{label}</T>
      <T weight="medium" style={{ fontSize: 15, textAlign: "right", flexShrink: 1 }} numberOfLines={2}>{value}</T>
    </View>
  );
}

/** One destination in depth: why it fits, when to go, the budget, and the ways to go further. */
export default function DestinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { L } = useStore();
  const lang = useLang();
  const ex = useExplore();
  const accent = useAccent();
  const { createTrip } = useTrips();
  const d = destinationById(String(id));

  if (!d) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 60, alignItems: "center" }]}>
        <T style={{ color: colors.text2 }}>{L("This place isn't available.", "Ce lieu n'est pas disponible.")}</T>
      </View>
    );
  }

  const name = pick(d.name, lang);
  const known = ex.profile.answered >= MIN_ANSWERS;
  const because = known
    ? (Object.entries(ex.profile.vector) as [Trait, number][])
        .filter(([t, u]) => Math.sign(u) === Math.sign(d.traits[t] ?? 0) && Math.abs(u) >= 0.3 && Math.abs(d.traits[t] ?? 0) >= 0.3)
        .sort((a, b) => Math.abs(b[1] * (d.traits[b[0]] ?? 0)) - Math.abs(a[1] * (d.traits[a[0]] ?? 0)))
        .map(([t, u]) => poleOf(t, u))
    : [];
  const reasons = reasonsFor(d, because);

  const plan = () => {
    const trip = createTrip({ destination: name, destinationCode: d.airport, country: pick(d.country, lang) });
    router.push({ pathname: "/trips/[id]", params: { id: trip.id } });
  };

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <PlacePhoto title={d.photo} style={[s.hero, { paddingTop: insets.top }]} fade={0.96}>
          <View style={{ flex: 1 }} />
          <View style={{ padding: 22, gap: 6 }}>
            <T style={{ fontSize: 12, letterSpacing: 1, color: "rgba(255,255,255,0.75)" }}>{pick(d.country, lang).toUpperCase()}</T>
            <T style={s.name}>{name}</T>
            <T style={{ fontSize: 16, lineHeight: 23, color: "rgba(255,255,255,0.85)" }}>{pick(d.about, lang)}</T>
          </View>
        </PlacePhoto>

        <View style={{ paddingHorizontal: 20, gap: 32, marginTop: 28 }}>
          {known ? (
            <Animated.View entering={FadeIn.duration(450)} style={{ gap: 14 }}>
              <T weight="medium" style={s.kicker}>{L("WHY IT SUITS YOU", "POURQUOI IL VOUS CORRESPOND")}</T>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
                <T style={[s.match, { color: accent.hi }]}>{`${Math.round(matchScore(ex.profile, d) * 100)}%`}</T>
                <T style={{ fontSize: 15, lineHeight: 21, color: colors.text2, paddingBottom: 9, flex: 1 }}>{L("match with your travel style", "de compatibilité avec votre style")}</T>
              </View>
              {reasons.length ? (
                <View style={s.chips}>
                  {reasons.map((r) => (
                    <TraitChip key={r.pole} label={pick(r.label, lang)} />
                  ))}
                </View>
              ) : (
                <T style={{ fontSize: 15, color: colors.text2 }}>{L("A change of scene from your usual style.", "Un changement de votre style habituel.")}</T>
              )}
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeIn.delay(100).duration(450)} style={s.facts}>
            <Fact icon={<CalendarDays color={colors.text3} size={18} />} label={L("Best time", "Meilleure période")} value={bestSeason(d.bestMonths, lang)} />
            <Fact icon={<Wallet color={colors.text3} size={18} />} label={L("Budget", "Budget")} value={`${budgetSymbol(d.budget)} · ${pick(BUDGET_LABELS[d.budget], lang)}`} />
            <Fact icon={<PlaneLanding color={colors.text3} size={18} />} label={L("Fly into", "Arrivée")} value={airportLabel(d.airport)} last />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(200).duration(500)} style={{ gap: 10 }}>
            <PrimaryButton label={L(`Search flights to ${name}`, `Chercher des vols pour ${name}`)} onPress={() => flightsTo(name, d.airport, lang)} />
            <OutlineButton
              label={L(`Ask Pyrius about ${name}`, `Demander à Pyrius pour ${name}`)}
              icon={<MessageCircle color={colors.text} size={17} />}
              onPress={() =>
                askPyrius(
                  L(
                    `Tell me about visiting ${name}: what to see and do, where to stay and when to go.`,
                    `Parle-moi d'un voyage à ${name} : quoi voir et faire, où loger et quand partir.`,
                  ),
                )
              }
            />
            <OutlineButton label={L("Plan a trip here", "Planifier un voyage ici")} icon={<Luggage color={colors.text} size={17} />} onPress={plan} />
          </Animated.View>
          <T style={{ fontSize: 12, lineHeight: 17, color: colors.text3 }}>
            {L("Budget is a category for time on the ground, not a price. Flight prices come from a live search.", "Le budget est une catégorie pour le séjour sur place, pas un prix. Les prix des vols viennent d'une recherche en direct.")}
          </T>
        </View>
      </ScrollView>

      <View style={[s.bar, { top: insets.top + 6 }]} pointerEvents="box-none">
        <IconButton label={L("Back", "Retour")} onPress={() => router.back()} style={s.round}>
          <ChevronLeft color={colors.white} size={24} strokeWidth={2} />
        </IconButton>
        <SaveButton saved={ex.isSaved(d.id)} onPress={() => ex.toggleSaved(d.id)} light />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { height: 460 },
  name: { fontFamily: fonts.serif, fontSize: 52, lineHeight: 56, color: colors.white },
  kicker: { fontSize: 11, letterSpacing: 1.4, color: colors.text3 },
  match: { fontFamily: fonts.serif, fontSize: 64, lineHeight: 66 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  facts: { borderRadius: radii.xl, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: 16 },
  fact: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 12 },
  factLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  bar: { position: "absolute", left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  round: { backgroundColor: "rgba(9,10,13,0.5)", borderRadius: radii.pill },
});
