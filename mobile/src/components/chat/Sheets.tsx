import { Briefcase, CalendarRange, PlaneTakeoff } from "lucide-react-native";
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

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, paddingHorizontal: 8, borderRadius: radii.md },
});
