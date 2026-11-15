import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";
import { BedDouble, Car, Copy, ExternalLink, Plane } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { placeName } from "@/lib/data/world";
import type { Reservation, ReservationKind } from "@/lib/trips/types";
import { money } from "@/lib/utils";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { Sheet } from "../Sheet";
import { toast } from "../Toast";
import { OutlineButton, T, tap, useAccent } from "../ui";
import { dateRange, dateTime } from "./format";

export const KIND_ICON = { flight: Plane, hotel: BedDouble, car: Car } as const;

const PROVIDER = { duffel: "Duffel", "booking.com": "Booking.com" } as const;

function statusText(r: Reservation, L: (en: string, fr: string) => string) {
  return { confirmed: L("Confirmed", "Confirmée"), pending: L("Pending", "En attente"), changed: L("Schedule changed", "Horaire modifié"), cancelled: L("Cancelled", "Annulée") }[r.status];
}

/** The headline of a reservation: route, hotel or rental company, and its dates. */
function summary(r: Reservation, lang: "en" | "fr") {
  if (r.kind === "flight") {
    const first = r.segments[0];
    const last = r.segments.at(-1);
    return { title: first && last ? `${first.from} → ${last.to}` : "", sub: [first?.airline, first && dateTime(first.departAt, lang)].filter(Boolean).join(" · ") };
  }
  if (r.kind === "hotel") return { title: r.name, sub: dateRange(r.checkIn, r.checkOut, lang) };
  return { title: r.company, sub: dateRange(r.pickUp.at.slice(0, 10), r.dropOff.at.slice(0, 10), lang) };
}

export function ReservationCard({ r, onPress }: { r: Reservation; onPress: () => void }) {
  const { settings, L } = useStore();
  const lang = settings.locale === "fr" ? "fr" : "en";
  const Icon = KIND_ICON[r.kind];
  const { title, sub } = summary(r, lang);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.card, pressed && { backgroundColor: colors.surface }]}>
      <View style={s.icon}>
        <Icon color={colors.text} size={18} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="semibold" style={{ fontSize: 16 }} numberOfLines={1}>{title}</T>
        <T style={{ fontSize: 13, color: colors.text2 }} numberOfLines={1}>{sub}</T>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {r.confirmationCode ? <T weight="mono" style={{ fontSize: 13 }}>{r.confirmationCode}</T> : null}
        <T style={{ fontSize: 11, color: r.status === "cancelled" ? colors.error : r.status === "changed" ? colors.warning : colors.success }}>{statusText(r, L)}</T>
      </View>
    </Pressable>
  );
}

/** A category of the trip with nothing booked yet, and the search that would fill it. */
export function EmptyCategory({ kind, onFind }: { kind: ReservationKind; onFind: () => void }) {
  const { L } = useStore();
  const accent = useAccent();
  const Icon = KIND_ICON[kind];
  const text = { flight: L("No flight booked yet", "Aucun vol réservé"), hotel: L("No hotel booked yet", "Aucun hôtel réservé"), car: L("No rental car booked yet", "Aucune voiture réservée") }[kind];
  const action = { flight: L("Find flights", "Trouver des vols"), hotel: L("Find a hotel", "Trouver un hôtel"), car: L("Find a car", "Trouver une voiture") }[kind];
  return (
    <View style={s.empty}>
      <Icon color={colors.text3} size={20} strokeWidth={1.6} />
      <T style={{ flex: 1, fontSize: 14, color: colors.text2 }}>{text}</T>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          tap();
          onFind();
        }}
        style={({ pressed }) => [s.find, { borderColor: accent.line, opacity: pressed ? 0.7 : 1 }]}
      >
        <T weight="semibold" style={{ fontSize: 13, color: accent.hi }}>{action}</T>
      </Pressable>
    </View>
  );
}

function Row({ label, value, mono, copy }: { label: string; value?: string; mono?: boolean; copy?: boolean }) {
  const { L } = useStore();
  if (!value) return null;
  return (
    <View style={s.row}>
      <T style={{ fontSize: 13, color: colors.text3, width: 120 }}>{label}</T>
      <T weight={mono ? "mono" : "regular"} style={{ flex: 1, fontSize: 15 }} selectable>{value}</T>
      {copy ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={L("Copy", "Copier")}
          hitSlop={8}
          onPress={() => {
            Clipboard.setStringAsync(value).then(() => toast({ tone: "ok", title: L("Copied", "Copié") }));
          }}
        >
          <Copy color={colors.text2} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Everything about one reservation, as the provider confirmed it. */
export function ReservationSheet({ r, onClose }: { r: Reservation | null; onClose: () => void }) {
  const { L, settings } = useStore();
  const lang = settings.locale === "fr" ? "fr" : "en";
  if (!r) return null;
  const price = r.totalPrice !== undefined && r.currency ? money(r.totalPrice, r.currency as never, settings.locale) : undefined;
  return (
    <Sheet open={Boolean(r)} onClose={onClose} title={summary(r, lang).title} subtitle={`${statusText(r, L)} · ${PROVIDER[r.provider]}`}>
      <View style={{ gap: 4, paddingBottom: 8 }}>
        <Row label={L("Confirmation", "Confirmation")} value={r.confirmationCode} mono copy />
        {r.kind === "flight"
          ? r.segments.map((g, i) => (
              <View key={i} style={s.segment}>
                <T weight="semibold" style={{ fontSize: 15 }}>{`${g.flightNumber} · ${placeName(g.from, settings.locale)} → ${placeName(g.to, settings.locale)}`}</T>
                <T style={{ fontSize: 13, color: colors.text2 }}>{`${dateTime(g.departAt, lang)} → ${dateTime(g.arriveAt, lang)}${g.cabin ? ` · ${g.cabin}` : ""}`}</T>
              </View>
            ))
          : null}
        {r.kind === "flight" ? <Row label={L("Passengers", "Passagers")} value={r.passengers.join(", ")} /> : null}
        {r.kind === "hotel" ? (
          <>
            <Row label={L("Address", "Adresse")} value={[r.address, r.city].filter(Boolean).join(", ")} />
            <Row label={L("Check-in", "Arrivée")} value={dateTime(r.checkIn, lang)} />
            <Row label={L("Check-out", "Départ")} value={dateTime(r.checkOut, lang)} />
            <Row label={L("Room", "Chambre")} value={[r.roomType, `${r.rooms} × ${r.guests} ${L("guests", "voyageurs")}`].filter(Boolean).join(" · ")} />
          </>
        ) : null}
        {r.kind === "car" ? (
          <>
            <Row label={L("Vehicle", "Véhicule")} value={r.vehicle} />
            <Row label={L("Pick-up", "Prise en charge")} value={`${r.pickUp.place} · ${dateTime(r.pickUp.at, lang)}`} />
            <Row label={L("Drop-off", "Restitution")} value={`${r.dropOff.place} · ${dateTime(r.dropOff.at, lang)}`} />
          </>
        ) : null}
        <Row label={L("Total paid", "Total payé")} value={price} mono />
        <Row label={L("Booked", "Réservé le")} value={dateTime(r.bookedAt.slice(0, 10), lang)} />
        {r.manageUrl ? (
          <OutlineButton style={{ marginTop: 12 }} label={L(`Manage on ${PROVIDER[r.provider]}`, `Gérer sur ${PROVIDER[r.provider]}`)} icon={<ExternalLink color={colors.text} size={16} />} onPress={() => WebBrowser.openBrowserAsync(r.manageUrl!)} />
        ) : null}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.xl, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  empty: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.xl, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border },
  find: { height: 34, paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.borderSoft },
  segment: { gap: 2, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.borderSoft },
});
