import { getRecordingPermissionsAsync } from "expo-audio";
import { ChevronRight, LogOut } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { AppState, Linking, Pressable, StyleSheet, Switch, TextInput, View } from "react-native";
import { findAirport } from "@/lib/data/world";
import { planById } from "@/lib/plans";
import type { Currency, Locale } from "@/lib/types";
import { AirportPicker } from "~/components/AirportPicker";
import { Divider, Page, Section } from "~/components/Page";
import { ThemePicker } from "~/components/ThemePicker";
import { VoiceOptions } from "~/components/VoiceOptions";
import { T, tap, useAccent } from "~/components/ui";
import { getNotificationPermission, requestNotificationPermission } from "~/lib/notifications";
import { useStore } from "~/lib/store";
import { colors, fonts, radii, noOutline } from "~/lib/theme";


function Row({ label, value, onPress, right, sub }: { label: string; value?: string; onPress?: () => void; right?: ReactNode; sub?: string }) {
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => [s.row, pressed && onPress && { backgroundColor: colors.surface }]}>
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 16 }}>{label}</T>
        {sub ? <T style={{ fontSize: 13, color: colors.text3, marginTop: 2 }}>{sub}</T> : null}
      </View>
      {value ? <T style={{ fontSize: 15, color: colors.text2 }}>{value}</T> : null}
      {right ?? (onPress ? <ChevronRight color={colors.text3} size={18} /> : null)}
    </Pressable>
  );
}

function Segments<V extends string>({ value, options, onChange }: { value: V; options: [V, string][]; onChange: (v: V) => void }) {
  const accent = useAccent();
  return (
    <View style={s.segments} accessibilityRole="radiogroup">
      {options.map(([v, label]) => (
        <Pressable
          key={v}
          accessibilityRole="radio"
          accessibilityState={{ checked: v === value }}
          onPress={() => {
            tap();
            onChange(v);
          }}
          style={[s.segment, v === value && { backgroundColor: colors.surface3, borderColor: accent.line }]}
        >
          <T weight="medium" style={{ fontSize: 14, color: v === value ? colors.text : colors.text2 }}>{label}</T>
        </Pressable>
      ))}
    </View>
  );
}

export default function Settings() {
  const { L, settings, updateSettings, voice, updateVoice, auth, subscription, signOut } = useStore();
  const accent = useAccent();
  const [airport, setAirport] = useState(false);
  const [mic, setMic] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [alerts, setAlerts] = useState<"granted" | "denied" | "undetermined">("undetermined");
  const [name, setName] = useState(settings.name);

  // Permissions can change in the system settings while Pyrius is open; re-read them on return.
  useEffect(() => {
    const read = () => {
      getRecordingPermissionsAsync().then((p) => setMic(p.status as typeof mic), () => {});
      getNotificationPermission().then(setAlerts, () => {});
    };
    read();
    const sub = AppState.addEventListener("change", (st) => st === "active" && read());
    return () => sub.remove();
  }, []);

  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string) => (
    <Switch value={value} onValueChange={onChange} trackColor={{ true: accent.accent, false: colors.surface3 }} thumbColor={colors.white} ios_backgroundColor={colors.surface3} accessibilityLabel={label} />
  );

  const home = findAirport(settings.homeAirport);
  const email = auth.mode === "cloud" ? auth.email : settings.email;
  const permText = (p: string) => (p === "granted" ? L("Allowed", "Autorisé") : p === "denied" ? L("Off", "Désactivé") : L("Not asked yet", "Pas encore demandé"));

  return (
    <Page title={L("Settings", "Réglages")}>
      <Section title={L("Profile", "Profil")}>
        <View style={s.row}>
          <T style={{ fontSize: 16, width: 90 }}>{L("Name", "Nom")}</T>
          <TextInput
            value={name}
            onChangeText={setName}
            onEndEditing={() => updateSettings({ name: name.trim() })}
            placeholder={L("Your name", "Votre nom")}
            placeholderTextColor={colors.text3}
            style={s.input}
            accessibilityLabel={L("Name", "Nom")}
            textContentType="name"
            autoComplete="name"
          />
        </View>
        <Divider />
        <Row label={L("Email", "Courriel")} value={email || "—"} />
        <Divider />
        <Row label={L("Plan", "Forfait")} value={planById(subscription.plan).name} />
      </Section>

      <Section title={L("Travel", "Voyage")}>
        <Row label={L("Home airport", "Aéroport de départ")} value={home ? `${home.city} (${home.code})` : settings.homeAirport} onPress={() => setAirport(true)} />
        <Divider />
        <View style={[s.row, { flexDirection: "column", alignItems: "stretch", gap: 10 }]}>
          <T style={{ fontSize: 16 }}>{L("Currency", "Devise")}</T>
          <Segments<Currency> value={settings.currency} options={[["CAD", "CAD"], ["USD", "USD"], ["EUR", "EUR"]]} onChange={(currency) => updateSettings({ currency })} />
        </View>
        <Divider />
        <View style={[s.row, { flexDirection: "column", alignItems: "stretch", gap: 10 }]}>
          <T style={{ fontSize: 16 }}>{L("Language", "Langue")}</T>
          <Segments<Locale> value={settings.locale} options={[["en", "English"], ["fr", "Français"]]} onChange={(locale) => updateSettings({ locale })} />
        </View>
      </Section>

      <Section title={L("Orb light", "Lumière de l'orbe")}>
        <View style={{ padding: 14 }}>
          <ThemePicker />
        </View>
      </Section>

      <Section
        title={L("Voice", "Voix")}
        footer={L(
          "Your voice goes straight to OpenAI to be understood and answered; Pyrius doesn't record or keep audio. Transcripts are saved in the conversation like typed messages.",
          "Votre voix est envoyée directement à OpenAI pour être comprise; Pyrius n'enregistre ni ne conserve l'audio. Les transcriptions sont gardées dans la conversation comme les messages écrits.",
        )}
      >
        <Row label={L("Voice conversations", "Conversations vocales")} right={toggle(voice.enabled && !voice.textOnly, (v) => updateVoice({ enabled: v, textOnly: v ? false : voice.textOnly }), L("Voice conversations", "Conversations vocales"))} />
        <Divider />
        <Row label={L("Text only", "Texte seulement")} sub={L("Hides the microphone and voice buttons.", "Masque les boutons micro et voix.")} right={toggle(voice.textOnly, (v) => updateVoice({ textOnly: v }), L("Text only", "Texte seulement"))} />
        <Divider />
        <Row
          label={L("Microphone", "Micro")}
          sub={mic === "denied" ? L("Turned off for Pyrius. Allow it in your phone's settings to talk or dictate.", "Désactivé pour Pyrius. Autorisez-le dans les réglages du téléphone.") : undefined}
          value={permText(mic)}
          onPress={mic === "denied" ? () => Linking.openSettings() : undefined}
        />
        {!voice.textOnly && voice.enabled ? (
          <View style={{ padding: 10 }}>
            <VoiceOptions />
          </View>
        ) : null}
      </Section>

      <Section title={L("Notifications", "Notifications")}>
        <Row
          label={L("Price alerts", "Alertes de prix")}
          value={permText(alerts)}
          onPress={
            alerts === "denied"
              ? () => Linking.openSettings()
              : alerts === "undetermined"
                ? () => requestNotificationPermission(L("Price alerts", "Alertes de prix")).then(setAlerts, () => {})
                : undefined
          }
        />
      </Section>

      <Section title={L("Account", "Compte")}>
        <Pressable
          accessibilityRole="button"
          // Signed out: the layout's guards close the app screens and open the welcome screen.
          onPress={() => signOut()}
          style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.surface }]}
        >
          <LogOut color={colors.error} size={18} />
          <T style={{ fontSize: 16, color: colors.error }}>{L("Sign out", "Se déconnecter")}</T>
        </Pressable>
      </Section>

      <AirportPicker
        open={airport}
        onClose={() => setAirport(false)}
        title={L("Home airport", "Aéroport de départ")}
        onPick={(a) => {
          setAirport(false);
          updateSettings({ homeAirport: a.code });
        }}
      />
    </Page>
  );
}

const s = StyleSheet.create({
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  input: { ...noOutline, flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 16, textAlign: "right", paddingVertical: 4 },
  segments: { flexDirection: "row", gap: 8 },
  segment: { flex: 1, height: 40, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
});
