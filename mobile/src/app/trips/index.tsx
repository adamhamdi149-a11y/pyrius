import { router } from "expo-router";
import { ChevronLeft, Plus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sortTrips } from "@/lib/trips/organize";
import { toISODate } from "@/lib/utils";
import { MiniOrb } from "~/components/MiniOrb";
import { TripCard } from "~/components/trips/TripCard";
import { TripSheet } from "~/components/trips/TripSheet";
import { Headline, IconButton, PrimaryButton, T, tap } from "~/components/ui";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { useTrips } from "~/lib/trips";

/** My Trips: every trip in one place, upcoming first. Separate from Saved offers (bookmarks and tracked fares). */
export default function Trips() {
  const insets = useSafeAreaInsets();
  const { L, settings } = useStore();
  const { trips, ready, createTrip } = useTrips();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [planning, setPlanning] = useState(false);
  const groups = useMemo(() => sortTrips(trips, toISODate(new Date())), [trips]);
  const list = groups[tab];

  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      <View style={s.head}>
        <IconButton label={L("Back", "Retour")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/chat"))} style={{ marginLeft: -8 }}>
          <ChevronLeft color={colors.text} size={26} strokeWidth={1.8} />
        </IconButton>
        <IconButton label={L("Plan a trip", "Planifier un voyage")} onPress={() => setPlanning(true)} style={s.add}>
          <Plus color={colors.text} size={22} strokeWidth={2} />
        </IconButton>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 18 }} showsVerticalScrollIndicator={false}>
        <Headline before={L("My", "Mes")} serif={L("trips", "voyages")} size={40} />
        <View style={s.segment} accessibilityRole="tablist">
          {(["upcoming", "past"] as const).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              onPress={() => {
                tap();
                setTab(t);
              }}
              style={[s.segBtn, tab === t && { backgroundColor: colors.surface3 }]}
            >
              <T weight="medium" style={{ fontSize: 14, color: tab === t ? colors.text : colors.text2 }}>
                {t === "upcoming" ? L("Upcoming", "À venir") : L("Past", "Passés")}
                {groups[t].length ? `  ${groups[t].length}` : ""}
              </T>
            </Pressable>
          ))}
        </View>

        {!ready ? null : list.length ? (
          list.map((t, i) => <TripCard key={t.id} trip={t} index={i} onPress={() => router.push({ pathname: "/trips/[id]", params: { id: t.id } })} />)
        ) : tab === "upcoming" ? (
          <Animated.View entering={FadeIn.duration(300)} style={s.empty}>
            <MiniOrb theme={settings.orbTheme} size={64} />
            <T weight="semibold" style={{ fontSize: 22, letterSpacing: -0.4, textAlign: "center" }}>{L("Your next trip starts here", "Votre prochain voyage commence ici")}</T>
            <T style={{ fontSize: 15, lineHeight: 22, color: colors.text2, textAlign: "center" }}>
              {L(
                "Plan a trip and keep everything together: flights, hotels and rental cars you book with Pyrius will be organized under it automatically.",
                "Planifiez un voyage et gardez tout au même endroit : les vols, hôtels et voitures réservés avec Pyrius s'y rangeront automatiquement.",
              )}
            </T>
            <PrimaryButton label={L("Plan a trip", "Planifier un voyage")} onPress={() => setPlanning(true)} style={{ alignSelf: "stretch", marginTop: 6 }} />
            <T style={{ fontSize: 12, lineHeight: 17, color: colors.text3, textAlign: "center" }}>
              {L("Booking directly in Pyrius is coming soon. Today, Pyrius finds the offers and the airline or provider takes the booking.", "La réservation directement dans Pyrius arrive bientôt. Aujourd'hui, Pyrius trouve les offres et la compagnie ou le fournisseur prend la réservation.")}
            </T>
          </Animated.View>
        ) : (
          <T style={{ fontSize: 15, color: colors.text2, textAlign: "center", paddingVertical: 60 }}>{L("Past trips will appear here.", "Vos voyages passés apparaîtront ici.")}</T>
        )}
      </ScrollView>
      {planning ? (
        <TripSheet
          open
          onClose={() => setPlanning(false)}
          onSave={(t) => {
            const trip = createTrip(t);
            router.push({ pathname: "/trips/[id]", params: { id: trip.id } });
          }}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  add: { backgroundColor: colors.surface, borderRadius: radii.pill },
  segment: { flexDirection: "row", padding: 4, borderRadius: radii.pill, backgroundColor: colors.surface },
  segBtn: { flex: 1, height: 38, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 14, paddingVertical: 36, paddingHorizontal: 22, borderRadius: radii.xxl + 4, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft, marginTop: 6 },
});
