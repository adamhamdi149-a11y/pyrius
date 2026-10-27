import { Pressable, StyleSheet, Switch, View } from "react-native";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { T, tap, useAccent } from "./ui";

export const VOICE_NAMES: { id: string; name: string; en: string; fr: string }[] = [
  { id: "marin", name: "Marin", en: "Warm, clear", fr: "Chaleureuse, claire" },
  { id: "cedar", name: "Cedar", en: "Calm, low", fr: "Calme, grave" },
  { id: "coral", name: "Coral", en: "Bright, friendly", fr: "Lumineuse, amicale" },
  { id: "sage", name: "Sage", en: "Soft, thoughtful", fr: "Douce, posée" },
  { id: "verse", name: "Verse", en: "Expressive", fr: "Expressive" },
  { id: "ash", name: "Ash", en: "Steady", fr: "Posée" },
];

/** Voice options; shared with Settings. */
export function VoiceOptions({ note }: { note?: string }) {
  const { L, voice, updateVoice, settings } = useStore();
  const accent = useAccent();
  return (
    <View style={{ gap: 6 }}>
      {VOICE_NAMES.map((v) => {
        const on = voice.voice === v.id;
        return (
          <Pressable
            key={v.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              tap();
              updateVoice({ voice: v.id });
            }}
            style={[s.voiceRow, on && { borderColor: accent.line, backgroundColor: colors.surface }]}
          >
            <View style={{ flex: 1 }}>
              <T weight="medium" style={{ fontSize: 16 }}>{v.name}</T>
              <T style={{ fontSize: 13, color: colors.text3 }}>{settings.locale === "fr" ? v.fr : v.en}</T>
            </View>
            <View style={[s.radio, on && { borderColor: accent.accent }]}>{on ? <View style={[s.radioDot, { backgroundColor: accent.accent }]} /> : null}</View>
          </Pressable>
        );
      })}
      <View style={s.switchRow}>
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: 16 }}>{L("Spoken replies", "Réponses à voix haute")}</T>
          <T style={{ fontSize: 13, color: colors.text3 }}>{L("Off: Pyrius answers in text while you speak.", "Désactivé : Pyrius répond par écrit pendant que vous parlez.")}</T>
        </View>
        <Switch value={voice.spoken} onValueChange={(v) => updateVoice({ spoken: v })} trackColor={{ true: accent.accent, false: colors.surface3 }} thumbColor={colors.white} ios_backgroundColor={colors.surface3} accessibilityLabel={L("Spoken replies", "Réponses à voix haute")} />
      </View>
      {note ? <T style={{ fontSize: 12, color: colors.text3, marginTop: 4 }}>{note}</T> : null}
    </View>
  );
}

const s = StyleSheet.create({
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.lg, borderWidth: 1, borderColor: "transparent" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginTop: 6 },
});
