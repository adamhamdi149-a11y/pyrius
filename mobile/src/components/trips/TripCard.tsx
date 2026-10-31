import { BedDouble, Car, Plane } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { byKind, tripDates, tripStatus } from "@/lib/trips/organize";
import type { Trip, TripStatus } from "@/lib/trips/types";
import { toISODate } from "@/lib/utils";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { PlacePhoto } from "../PlacePhoto";
import { T, tap, useAccent } from "../ui";
import { dateRange, STATUS_LABEL, tripPhoto } from "./format";

export function StatusPill({ status }: { status: TripStatus }) {
  const { settings } = useStore();
  const accent = useAccent();
  const tone = status === "cancelled" ? colors.error : status === "completed" || status === "planning" ? colors.text2 : status === "upcoming" ? colors.success : accent.hi;
  return (
    <View style={s.pill}>
      <View style={[s.dot, { backgroundColor: tone }]} />
      <T weight="medium" style={{ fontSize: 12, color: colors.text }}>{STATUS_LABEL[status][settings.locale === "fr" ? "fr" : "en"]}</T>
    </View>
  );
}

/** A trip as a photo card: where, when, where it stands, and what's booked in each category. */
export function TripCard({ trip, index, onPress }: { trip: Trip; index: number; onPress: () => void }) {
  const { settings, L } = useStore();
  const lang = settings.locale === "fr" ? "fr" : "en";
  const status = tripStatus(trip, toISODate(new Date()));
  const { start, end } = tripDates(trip);
  const counts = [
    { Icon: Plane, n: byKind(trip, "flight").length, label: L("flights", "vols") },
    { Icon: BedDouble, n: byKind(trip, "hotel").length, label: L("hotels", "hôtels") },
    { Icon: Car, n: byKind(trip, "car").length, label: L("rental cars", "voitures") },
  ];
  return (
    <Animated.View entering={FadeInDown.delay(60 * index).springify().damping(20)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${trip.destination}, ${dateRange(start, end, lang)}, ${STATUS_LABEL[status][lang]}`}
        onPress={() => {
          tap();
          onPress();
        }}
        style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}
      >
        <PlacePhoto title={tripPhoto(trip)} style={s.card}>
          <View style={s.top}>
            <StatusPill status={status} />
          </View>
          <View style={s.bottom}>
            <T weight="semibold" style={s.city} numberOfLines={1}>{trip.destination}</T>
            <T style={s.dates}>{[dateRange(start, end, lang), trip.country].filter(Boolean).join(" · ")}</T>
            <View style={s.counts}>
              {counts.map(({ Icon, n, label }) => (
                <View key={label} style={[s.count, !n && { opacity: 0.5 }]} accessibilityLabel={`${n} ${label}`}>
                  <Icon color={colors.white} size={14} strokeWidth={1.9} />
                  <T weight="mono" style={{ fontSize: 12, color: colors.white }}>{n}</T>
                </View>
              ))}
            </View>
          </View>
        </PlacePhoto>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { height: 230, borderRadius: radii.xxl + 4, borderWidth: 1, borderColor: colors.borderSoft, justifyContent: "space-between" },
  top: { padding: 14, flexDirection: "row" },
  bottom: { padding: 18, gap: 4 },
  city: { fontSize: 28, letterSpacing: -0.6, color: colors.white },
  dates: { fontSize: 14, color: "rgba(255,255,255,0.78)" },
  counts: { flexDirection: "row", gap: 8, marginTop: 10 },
  count: { flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.14)" },
  pill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: 11, borderRadius: radii.pill, backgroundColor: "rgba(9,10,13,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
