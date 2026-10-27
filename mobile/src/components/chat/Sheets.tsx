import { router } from "expo-router";
import { BedDouble, BellRing, Bookmark, Briefcase, CalendarRange, Car, Plane, PlaneTakeoff } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import type { QuickPrefs } from "~/lib/conversation";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { Sheet } from "../Sheet";
import { T, tap, useAccent } from "../ui";

/** The trip preferences behind the composer's Preferences button (same three as the web app). */
export function PrefsSheet({ open, onClose, prefs, onChange }: { open: boolean; onClose: () => void; prefs: QuickPrefs; onChange: (p: QuickPrefs) => void }) {
  const { L } = useStore();
  const accent = useAccent();
  const rows: [keyof QuickPrefs, string, ReactNode][] = [
    ["nonstopOnly", L("Nonstop flights only", "Vols directs seulement"), <PlaneTakeoff key="n" color={colors.text2} size={18} />],
    ["carryOnOnly", L("Carry-on included", "Bagage cabine inclus"), <Briefcase key="c" color={colors.text2} size={18} />],
    ["flexibleDates", L("My dates are flexible", "Mes dates sont flexibles"), <CalendarRange key="f" color={colors.text2} size={18} />],
  ];
  return (
    <Sheet open={open} onClose={onClose} title={L("Preferences", "Préférences")} subtitle={L("Applied to this trip. Pyrius won't ask again.", "Appliquées à ce voyage. Pyrius ne redemandera pas.")}>
      <View style={{ gap: 4, paddingBottom: 8 }}>
        {rows.map(([key, label, icon]) => (
          <Pressable
            key={key}
            accessibilityRole="switch"
            accessibilityState={{ checked: Boolean(prefs[key]) }}
            onPress={() => {
              tap();
              onChange({ ...prefs, [key]: !prefs[key] || undefined });
            }}
            style={s.row}
          >
            {icon}
            <T style={{ flex: 1, fontSize: 16 }}>{label}</T>
            <Switch
              value={Boolean(prefs[key])}
              onValueChange={(v) => onChange({ ...prefs, [key]: v || undefined })}
              trackColor={{ true: accent.accent, false: colors.surface3 }}
              thumbColor={colors.white}
              ios_backgroundColor={colors.surface3}
              accessibilityElementsHidden
            />
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

/** The composer's + button: quick starts and the places the menu also leads to. */
export function PlusSheet({ open, onClose, onPrompt, hasTrip }: { open: boolean; onClose: () => void; onPrompt: (text: string, send: boolean) => void; hasTrip: boolean }) {
  const { L } = useStore();
  const go = (path: "/saved" | "/tracking") => {
    onClose();
    router.push(path);
  };
  const items: { icon: ReactNode; label: string; run: () => void }[] = [
    { icon: <Plane color={colors.text} size={20} strokeWidth={1.7} />, label: L("Find flights", "Trouver des vols"), run: () => onPrompt(L("Flights from ", "Vols de "), false) },
    { icon: <BedDouble color={colors.text} size={20} strokeWidth={1.7} />, label: L("A place to stay", "Un hébergement"), run: () => (hasTrip ? onPrompt(L("Show me hotels for this trip.", "Montre-moi des hôtels pour ce voyage."), true) : onPrompt(L("A hotel in ", "Un hôtel à "), false)) },
    { icon: <Car color={colors.text} size={20} strokeWidth={1.7} />, label: L("Rent a car", "Louer une voiture"), run: () => (hasTrip ? onPrompt(L("Show me rental cars for this trip.", "Montre-moi des voitures de location pour ce voyage."), true) : onPrompt(L("A rental car in ", "Une voiture de location à "), false)) },
    { icon: <Bookmark color={colors.text} size={20} strokeWidth={1.7} />, label: L("Saved offers", "Offres enregistrées"), run: () => go("/saved") },
    { icon: <BellRing color={colors.text} size={20} strokeWidth={1.7} />, label: L("Price tracking", "Suivi des prix"), run: () => go("/tracking") },
  ];
  return (
    <Sheet open={open} onClose={onClose}>
      <View style={{ gap: 2, paddingBottom: 8 }}>
        {items.map((it) => (
          <Pressable
            key={it.label}
            accessibilityRole="button"
            onPress={() => {
              tap();
              onClose();
              it.run();
            }}
            style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.surface }]}
          >
            {it.icon}
            <T style={{ fontSize: 16 }}>{it.label}</T>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, paddingHorizontal: 8, borderRadius: radii.md },
});
