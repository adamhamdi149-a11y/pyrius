import { Pressable, StyleSheet, View } from "react-native";
import { ORB_THEMES, type OrbThemeId } from "@/lib/orbThemes";
import { useStore } from "~/lib/store";
import { accentFor, colors, radii } from "~/lib/theme";
import { MiniOrb } from "./MiniOrb";
import { T, tap } from "./ui";

const NAMES: Record<OrbThemeId, [string, string]> = { ember: ["Ember", "Braise"], arctic: ["Arctic", "Arctique"], violet: ["Violet", "Violet"] };

/** The last setup step: the orb's colour, which also becomes the app's accent. */
export function ThemePicker() {
  const { L, settings, updateSettings } = useStore();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={L("Orb colour", "Couleur de l'orbe")} style={s.grid}>
      {ORB_THEMES.map((t) => {
        const on = settings.orbTheme === t.id;
        const a = accentFor(t.id);
        return (
          <Pressable
            key={t.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={NAMES[t.id][settings.locale === "fr" ? 1 : 0]}
            onPress={() => {
              tap();
              updateSettings({ orbTheme: t.id });
            }}
            style={[s.swatch, { borderColor: on ? a.line : colors.borderSoft, backgroundColor: on ? colors.bg2 : "transparent" }]}
          >
            <View style={{ boxShadow: `0 0 18px ${a.line}`, borderRadius: 22 }}>
              <MiniOrb theme={t.id} />
            </View>
            <T weight="medium" style={{ fontSize: 13, color: on ? colors.text : colors.text2 }}>{L(NAMES[t.id][0], NAMES[t.id][1])}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", gap: 12 },
  swatch: { flex: 1, alignItems: "center", gap: 12, paddingTop: 18, paddingBottom: 14, borderRadius: radii.xl, borderWidth: 1 },
});
