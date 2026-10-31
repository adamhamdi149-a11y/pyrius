import { router } from "expo-router";
import { CalendarDays, Plane, Wallet } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { bestSeason, BUDGET_LABELS, budgetSymbol, type Recommendation } from "@/lib/explore/engine";
import { useExplore } from "~/lib/explore";
import { askPyrius } from "~/lib/handoff";
import { useStore } from "~/lib/store";
import { colors, fonts, radii } from "~/lib/theme";
import { PlacePhoto } from "../PlacePhoto";
import { T, tap, useAccent } from "../ui";
import { pick, SaveButton, useLang } from "./parts";

/** Asks Pyrius for flights to a destination, in the user's language. */
export function flightsTo(name: string, airport: string, lang: "en" | "fr") {
  askPyrius(lang === "fr" ? `Trouve-moi des vols pour ${name} (${airport}).` : `Find me flights to ${name} (${airport}).`);
}

/** A recommended destination: photo, match, why it fits, best time, budget, and the two next steps. */
export function DestinationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const { L } = useStore();
  const lang = useLang();
  const accent = useAccent();
  const ex = useExplore();
  const d = rec.destination;
  const open = () => router.push({ pathname: "/explore/[id]", params: { id: d.id } });
  return (
    <Animated.View entering={FadeInDown.delay(120 * index).duration(600)} style={s.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${pick(d.name, lang)}, ${pick(d.country, lang)}`} onPress={open}>
        <PlacePhoto title={d.photo} style={s.photo}>
          <View style={s.photoTop}>
            <View style={[s.match, { backgroundColor: accent.accent }]}>
              <T weight="semibold" style={{ fontSize: 13, color: accent.ink }}>{L(`${rec.match}% match`, `${rec.match} % compatible`)}</T>
            </View>
            <SaveButton saved={ex.isSaved(d.id)} onPress={() => ex.toggleSaved(d.id)} light />
          </View>
          <View style={{ padding: 18 }}>
            <T style={s.name}>{pick(d.name, lang)}</T>
            <T style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>{pick(d.country, lang)}</T>
          </View>
        </PlacePhoto>
      </Pressable>
      <View style={s.body}>
        <View style={{ gap: 10 }}>
          {rec.reasons.length ? (
            rec.reasons.map((r) => (
              <View key={r.pole} style={s.reason}>
                <View style={[s.bullet, { backgroundColor: accent.hi }]} />
                <T style={{ flex: 1, fontSize: 15, lineHeight: 21 }}>
                  <T weight="semibold" style={{ fontSize: 15 }}>{`${pick(r.label, lang)}: `}</T>
                  <T style={{ fontSize: 15, color: colors.text2 }}>{pick(r.text, lang)}</T>
                </T>
              </View>
            ))
          ) : (
            <T style={{ fontSize: 15, lineHeight: 21, color: colors.text2 }}>{pick(d.about, lang)}</T>
          )}
        </View>
        <View style={s.meta}>
          <View style={s.metaItem}>
            <CalendarDays color={colors.text3} size={15} />
            <T style={s.metaText}>{bestSeason(d.bestMonths, lang)}</T>
          </View>
          <View style={s.metaItem}>
            <Wallet color={colors.text3} size={15} />
            <T style={s.metaText}>{`${budgetSymbol(d.budget)} · ${pick(BUDGET_LABELS[d.budget], lang)}`}</T>
          </View>
        </View>
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tap();
              open();
            }}
            style={({ pressed }) => [s.btn, { backgroundColor: colors.surface2, opacity: pressed ? 0.8 : 1 }]}
          >
            <T weight="semibold" style={{ fontSize: 15 }}>{L("Explore", "Explorer")}</T>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tap();
              flightsTo(pick(d.name, lang), d.airport, lang);
            }}
            style={({ pressed }) => [s.btn, { backgroundColor: accent.accent, opacity: pressed ? 0.85 : 1 }]}
          >
            <Plane color={accent.ink} size={16} strokeWidth={2.2} />
            <T weight="semibold" style={{ fontSize: 15, color: accent.ink }}>{L("Flights", "Vols")}</T>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radii.xxl + 4, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft, overflow: "hidden" },
  photo: { height: 280, justifyContent: "space-between" },
  photoTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  match: { height: 30, paddingHorizontal: 12, borderRadius: radii.pill, justifyContent: "center" },
  name: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, color: colors.white },
  body: { padding: 18, gap: 16 },
  reason: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 13, color: colors.text2 },
  actions: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, height: 48, borderRadius: radii.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
