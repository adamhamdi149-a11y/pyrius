import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, MoreHorizontal, Pencil, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { byKind, tripDates, tripStatus } from "@/lib/trips/organize";
import type { Reservation, ReservationKind } from "@/lib/trips/types";
import { toISODate } from "@/lib/utils";
import { confirmDialog, showActions, showDialog } from "~/components/Dialog";
import { PlacePhoto } from "~/components/PlacePhoto";
import { dateRange, tripPhoto } from "~/components/trips/format";
import { EmptyCategory, KIND_ICON, ReservationCard, ReservationSheet } from "~/components/trips/Reservations";
import { StatusPill } from "~/components/trips/TripCard";
import { TripSheet } from "~/components/trips/TripSheet";
import { IconButton, T } from "~/components/ui";
import { askPyrius } from "~/lib/handoff";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { useTrips } from "~/lib/trips";

/** One trip: its photo, dates and status, then Flights, Hotels and Rental cars, each with what's booked. */
export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { L, settings } = useStore();
  const { trips, updateTrip, deleteTrip } = useTrips();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<Reservation | null>(null);
  const trip = trips.find((t) => t.id === id);
  const lang = settings.locale === "fr" ? "fr" : "en";

  if (!trip) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 60, alignItems: "center" }]}>
        <T style={{ color: colors.text2 }}>{L("This trip isn't here anymore.", "Ce voyage n'existe plus.")}</T>
      </View>
    );
  }

  const { start, end } = tripDates(trip);
  const status = tripStatus(trip, toISODate(new Date()));
  const when = start ? `, ${dateRange(start, end, lang)}` : "";
  const find = (kind: ReservationKind) =>
    askPyrius(
      kind === "flight"
        ? L(`Find me flights to ${trip.destination}${when}.`, `Trouve-moi des vols pour ${trip.destination}${when}.`)
        : kind === "hotel"
          ? L(`Find me a hotel in ${trip.destination}${when}.`, `Trouve-moi un hôtel à ${trip.destination}${when}.`)
          : L(`Find me a rental car in ${trip.destination}${when}.`, `Trouve-moi une voiture de location à ${trip.destination}${when}.`),
    );

  const menu = () => {
    const remove = () => {
      if (trip.reservations.length) {
        showDialog({
          title: L("This trip has bookings", "Ce voyage a des réservations"),
          message: L("Trips with bookings stay in My Trips so you never lose a confirmation.", "Les voyages avec réservations restent dans Mes voyages pour ne jamais perdre une confirmation."),
        });
        return;
      }
      confirmDialog({
        title: L("Delete this trip?", "Supprimer ce voyage ?"),
        message: L(`${trip.destination} will be removed from My Trips.`, `${trip.destination} sera retiré de Mes voyages.`),
        cancel: L("Cancel", "Annuler"),
        confirm: L("Delete", "Supprimer"),
        destructive: true,
        onConfirm: () => {
          deleteTrip(trip.id);
          router.back();
        },
      });
    };
    showActions({
      title: trip.destination,
      actions: [
        { label: L("Edit trip", "Modifier le voyage"), icon: <Pencil color={colors.text} size={18} strokeWidth={1.8} />, onPress: () => setEditing(true) },
        { label: L("Delete trip", "Supprimer le voyage"), tone: "destructive", icon: <Trash2 color={colors.error} size={18} strokeWidth={1.8} />, onPress: remove },
      ],
    });
  };

  const sections: { kind: ReservationKind; title: string }[] = [
    { kind: "flight", title: L("Flights", "Vols") },
    { kind: "hotel", title: L("Hotels", "Hôtels") },
    { kind: "car", title: L("Rental cars", "Voitures de location") },
  ];

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <PlacePhoto title={tripPhoto(trip)} size="large" portrait style={[s.hero, { paddingTop: insets.top }]} fade={0.95}>
          <View style={{ flex: 1 }} />
          <View style={{ padding: 20, gap: 8 }}>
            <StatusPill status={status} />
            <T weight="semibold" style={s.city}>{trip.destination}</T>
            <T style={{ fontSize: 15, color: "rgba(255,255,255,0.8)" }}>{[dateRange(start, end, lang), trip.country].filter(Boolean).join(" · ")}</T>
          </View>
        </PlacePhoto>

        <View style={{ paddingHorizontal: 20, gap: 26, marginTop: 22 }}>
          {sections.map(({ kind, title }, i) => {
            const items = byKind(trip, kind);
            const Icon = KIND_ICON[kind];
            return (
              <Animated.View key={kind} entering={FadeIn.delay(50 * i).duration(300)} style={{ gap: 10 }}>
                <View style={s.sectionHead}>
                  <Icon color={colors.text2} size={17} strokeWidth={1.8} />
                  <T weight="semibold" style={{ fontSize: 17, flex: 1 }}>{title}</T>
                  {items.length ? <T weight="mono" style={{ fontSize: 13, color: colors.text3 }}>{items.length}</T> : null}
                </View>
                {items.length ? items.map((r) => <ReservationCard key={r.id} r={r} onPress={() => setOpen(r)} />) : <EmptyCategory kind={kind} onFind={() => find(kind)} />}
              </Animated.View>
            );
          })}
          <T style={{ fontSize: 12, lineHeight: 17, color: colors.text3 }}>
            {L(
              "Bookings made with Pyrius appear here automatically with their confirmation numbers. Pyrius never adds a booking that the airline, hotel or rental company hasn't confirmed.",
              "Les réservations faites avec Pyrius apparaissent ici automatiquement avec leur numéro de confirmation. Pyrius n'ajoute jamais une réservation non confirmée par la compagnie, l'hôtel ou le loueur.",
            )}
          </T>
        </View>
      </ScrollView>

      <View style={[s.bar, { top: insets.top + 6 }]} pointerEvents="box-none">
        <IconButton label={L("Back", "Retour")} onPress={() => router.back()} style={s.round}>
          <ChevronLeft color={colors.white} size={24} strokeWidth={2} />
        </IconButton>
        <IconButton label={L("Trip options", "Options du voyage")} onPress={menu} style={s.round}>
          <MoreHorizontal color={colors.white} size={22} strokeWidth={2} />
        </IconButton>
      </View>

      <ReservationSheet r={open} onClose={() => setOpen(null)} />
      {editing ? (
        <TripSheet
          open
          onClose={() => setEditing(false)}
          initial={{ destination: trip.destination, destinationCode: trip.destinationCode, country: trip.country, startDate: trip.startDate, endDate: trip.endDate }}
          onSave={(t) => updateTrip(trip.id, t)}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { height: 380 },
  city: { fontSize: 40, letterSpacing: -1, color: colors.white },
  bar: { position: "absolute", left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" },
  round: { backgroundColor: "rgba(9,10,13,0.5)", borderRadius: radii.pill },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
});
