import { Heart } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Bilingual } from "@/lib/explore/traits";
import { useStore } from "~/lib/store";
import { colors, fonts, radii } from "~/lib/theme";
import { T, tap, useAccent } from "../ui";

export const useLang = () => (useStore().settings.locale === "fr" ? "fr" : "en");
export const pick = (b: Bilingual, lang: "en" | "fr") => b[lang];

/** "The Tropical Explorer" with the expressive part in the serif, like the app's headlines. */
export function PersonalityName({ name, size = 40, center }: { name: string; size?: number; center?: boolean }) {
  const accent = useAccent();
  const m = name.match(/^(The|Le|La|Les)\s+(.*)$/);
  const lead = m ? m[1] : "";
  const rest = m ? m[2] : name;
  return (
    <Text accessibilityRole="header" style={{ fontFamily: fonts.medium, fontSize: size, lineHeight: size * 1.08, letterSpacing: -size * 0.03, color: colors.text, textAlign: center ? "center" : "left" }}>
      {lead ? `${lead} ` : ""}
      <Text style={{ fontFamily: fonts.serif, color: accent.hi, fontSize: size * 1.06, letterSpacing: -size * 0.01 }}>{rest}</Text>
    </Text>
  );
}

export function TraitChip({ label }: { label: string }) {
  return (
    <View style={s.chip}>
      <T weight="medium" style={{ fontSize: 13, color: colors.text }}>{label}</T>
    </View>
  );
}

/** Save a destination for later. Saved places survive starting over. */
export function SaveButton({ saved, onPress, light }: { saved: boolean; onPress: () => void; light?: boolean }) {
  const { L } = useStore();
  const accent = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={saved ? L("Remove from saved places", "Retirer des lieux enregistrés") : L("Save this place", "Enregistrer ce lieu")}
      hitSlop={8}
      onPress={() => {
        tap();
        onPress();
      }}
      style={[s.save, light && { backgroundColor: "rgba(9,10,13,0.5)" }]}
    >
      <Heart color={saved ? accent.accent : colors.white} fill={saved ? accent.accent : "transparent"} size={19} strokeWidth={2} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: { height: 34, paddingHorizontal: 14, borderRadius: radii.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  save: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 },
});
