import { MapPin } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { WorldAirport } from "@/lib/data/world";
import type { NewTrip } from "~/lib/trips";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { AirportPicker } from "../AirportPicker";
import { DateRange } from "../DateRange";
import { Sheet } from "../Sheet";
import { PrimaryButton, T, TextButton } from "../ui";
import { dateRange } from "./format";

/** Plans a trip (or edits one): where, and optionally when. Bookings are added by providers, never here. */
export function TripSheet({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial?: NewTrip; onSave: (t: NewTrip) => void }) {
  const { L, settings } = useStore();
  const lang = settings.locale === "fr" ? "fr" : "en";
  const [place, setPlace] = useState<Pick<NewTrip, "destination" | "destinationCode" | "country"> | null>(initial ? { destination: initial.destination, destinationCode: initial.destinationCode, country: initial.country } : null);
  const [start, setStart] = useState(initial?.startDate);
  const [end, setEnd] = useState(initial?.endDate);
  const [picking, setPicking] = useState(false);

  const choose = (a: WorldAirport) => {
    setPicking(false);
    setPlace({ destination: a.city, destinationCode: a.code, country: a.country });
  };

  return (
    <Sheet open={open} onClose={onClose} title={initial ? L("Edit trip", "Modifier le voyage") : L("Plan a trip", "Planifier un voyage")} subtitle={L("Bookings you make with Pyrius will be added to it automatically.", "Les réservations faites avec Pyrius s'y ajouteront automatiquement.")}>
      <View style={{ gap: 18 }}>
        <Pressable accessibilityRole="button" onPress={() => setPicking(true)} style={s.field}>
          <MapPin color={colors.text2} size={18} />
          <View style={{ flex: 1 }}>
            <T style={{ fontSize: 12, color: colors.text3 }}>{L("Destination", "Destination")}</T>
            <T weight="medium" style={{ fontSize: 16, color: place ? colors.text : colors.text3 }}>{place ? [place.destination, place.country].filter(Boolean).join(", ") : L("Where are you going?", "Où allez-vous ?")}</T>
          </View>
        </Pressable>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <T style={{ fontSize: 12, color: colors.text3 }}>{L("Dates (optional)", "Dates (facultatif)")}</T>
            <T weight="medium" style={{ fontSize: 13, color: colors.text2 }}>{dateRange(start, end, lang)}</T>
          </View>
          <DateRange
            start={start}
            end={end}
            onChange={(a, b) => {
              setStart(a);
              setEnd(b);
            }}
          />
          {start ? <TextButton label={L("Clear dates", "Effacer les dates")} onPress={() => (setStart(undefined), setEnd(undefined))} /> : null}
        </View>
        <PrimaryButton
          label={initial ? L("Save", "Enregistrer") : L("Create trip", "Créer le voyage")}
          disabled={!place}
          onPress={() => {
            if (!place) return;
            onSave({ ...place, startDate: start, endDate: end ?? start });
            onClose();
          }}
        />
      </View>
      <AirportPicker open={picking} onClose={() => setPicking(false)} onPick={choose} title={L("Where are you going?", "Où allez-vous ?")} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
