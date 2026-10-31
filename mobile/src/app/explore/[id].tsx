import { router, useLocalSearchParams } from "expo-router";
import { CalendarDays, ChevronLeft, Luggage, MessageCircle, PlaneLanding, Wallet } from "lucide-react-native";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { airportLabel } from "@/lib/data/world";
import { destinationById } from "@/lib/explore/destinations";
import { bestSeason, BUDGET_LABELS, budgetSymbol, matchScore, MIN_ANSWERS, reasonsFor } from "@/lib/explore/engine";
import { poleOf, type Trait } from "@/lib/explore/traits";
import { flightsTo } from "~/components/explore/DestinationCard";
import { pick, SaveButton, useLang } from "~/components/explore/parts";
import { PlacePhoto } from "~/components/PlacePhoto";
import { IconButton, OutlineButton, PrimaryButton, T } from "~/components/ui";
import { useExplore } from "~/lib/explore";
import { askPyrius } from "~/lib/handoff";
import { useStore } from "~/lib/store";
import { colors, fonts, radii } from "~/lib/theme";
import { useTrips } from "~/lib/trips";

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={s.fact}>
      {icon}
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 12, color: colors.text3 }}>{label}</T>
        <T weight="medium" style={{ fontSize: 15 }}>{value}</T>
      </View>
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

        <View style={{ paddingHorizontal: 20, gap: 22, marginTop: 20 }}>
          {known ? (
            <Animated.View entering={FadeInDown.duration(500)} style={s.why}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <T weight="semibold" style={{ fontSize: 17 }}>{L("Why Pyrius recommends it", "Pourquoi Pyrius le recommande")}</T>
                <T weight="mono" style={{ fontSize: 14, color: colors.text2 }}>{L(`${Math.round(matchScore(ex.profile, d) * 100)}% match`, `${Math.round(matchScore(ex.profile, d) * 100)} %`)}</T>
              </View>
              {reasons.length ? (
                reasons.map((r) => (
                  <T key={r.pole} style={{ fontSize: 15, lineHeight: 22 }}>
                    <T weight="semibold" style={{ fontSize: 15 }}>{`${pick(r.label, lang)}: `}</T>
                    <T style={{ fontSize: 15, color: colors.text2 }}>{pick(r.text, lang)}</T>
                  </T>
                ))
              ) : (
                <T style={{ fontSize: 15, color: colors.text2 }}>{L("A change of scene from your usual style, worth a look.", "Un changement par rapport à votre style habituel, à découvrir.")}</T>
              )}
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(100).duration(500)} style={{ gap: 10 }}>
            <Fact icon={<CalendarDays color={colors.text2} size={18} />} label={L("Best time to visit", "Meilleure période")} value={bestSeason(d.bestMonths, lang)} />
            <Fact icon={<Wallet color={colors.text2} size={18} />} label={L("Travel budget", "Budget de voyage")} value={`${budgetSymbol(d.budget)} · ${pick(BUDGET_LABELS[d.budget], lang)}`} />
            <Fact icon={<PlaneLanding color={colors.text2} size={18} />} label={L("Fly into", "Arrivée")} value={airportLabel(d.airport)} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={{ gap: 10 }}>
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
  why: { gap: 10, padding: 18, borderRadius: radii.xl, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft },
  fact: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radii.lg, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft },
  bar: { position: "absolute", left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  round: { backgroundColor: "rgba(9,10,13,0.5)", borderRadius: radii.pill },
});
