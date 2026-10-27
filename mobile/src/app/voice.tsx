import { router } from "expo-router";
import { ArrowUp, Keyboard, Mic, MicOff, SlidersHorizontal, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { messageAttachments, type FlightOffer } from "@/lib/types";
import { formatTime, money } from "@/lib/utils";
import { Glow } from "~/components/Glow";
import { Orb, type MobileOrbMood } from "~/components/Orb";
import { Sheet } from "~/components/Sheet";
import { VoiceOptions } from "~/components/VoiceOptions";
import { IconButton, PrimaryButton, T, tap } from "~/components/ui";
import { useKeyboardPadding } from "~/lib/keyboard";
import { useStore } from "~/lib/store";
import { colors, fonts, radii, noOutline } from "~/lib/theme";
import { useVoice } from "~/lib/voice/useVoice";

function MiniFlight({ o }: { o: FlightOffer }) {
  const { settings } = useStore();
  return (
    <View style={s.mini}>
      <T weight="medium" style={{ fontSize: 13 }} numberOfLines={1}>{o.airline.name}</T>
      <T weight="mono" style={{ fontSize: 13, color: colors.text2 }}>{`${formatTime(o.outbound.depart)} → ${formatTime(o.outbound.arrive)}`}</T>
      <T weight="mono" style={{ fontSize: 16 }}>{money(o.totalPrice, o.currency, settings.locale)}</T>
    </View>
  );
}

export default function VoiceScreen() {
  const { L, settings, voice, getConversation, conversations } = useStore();
  const insets = useSafeAreaInsets();
  const pad = useKeyboardPadding(12);
  const v = useVoice();
  const [text, setText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    v.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    v.stop();
    if (router.canGoBack()) router.back();
    else router.replace("/chat");
  };

  // Flights found during this conversation, cheapest first: the cards are in the chat too.
  const conv = v.conversationId ? conversations.find((c) => c.id === v.conversationId) ?? getConversation(v.conversationId) : undefined;
  const flights = useMemo(() => {
    for (let i = (conv?.messages.length ?? 0) - 1; i >= 0; i--) {
      const a = messageAttachments(conv!.messages[i]).find((x) => x.type === "flights");
      if (a?.type === "flights" && a.snapshot) return [...a.snapshot.offers].sort((x, y) => x.totalPrice - y.totalPrice).slice(0, 3);
    }
    return [];
  }, [conv]);

  const live = v.status === "listening" || v.status === "speaking" || v.status === "thinking";
  const mood: MobileOrbMood =
    v.status === "error" ? "error" : v.status === "speaking" ? "speaking" : v.status === "thinking" || v.status === "connecting" || v.status === "reconnecting" ? "thinking" : v.status === "listening" && !v.muted ? "listening" : "idle";

  const label =
    v.status === "connecting"
      ? L("Connecting…", "Connexion…")
      : v.status === "reconnecting"
        ? L("Reconnecting…", "Reconnexion…")
        : v.muted && live
          ? L("Microphone off", "Micro coupé")
          : v.status === "listening"
            ? v.userSpeaking
              ? L("Listening…", "Je vous écoute…")
              : L("Go ahead, I'm listening", "Allez-y, je vous écoute")
            : v.status === "thinking"
              ? L("Thinking…", "Je réfléchis…")
              : v.status === "speaking"
                ? L("Tap the orb to interrupt", "Touchez l'orbe pour interrompre")
                : v.status === "ended"
                  ? L("Voice ended", "Conversation vocale terminée")
                  : "";

  const endedText =
    v.ended === "limit"
      ? L("This voice session reached its time limit. Start again any time.", "Cette session vocale a atteint sa durée maximale. Recommencez quand vous voulez.")
      : v.ended === "background"
        ? L("Voice stopped when Pyrius went to the background.", "La voix s'est arrêtée quand Pyrius est passé en arrière-plan.")
        : v.ended === "expired"
          ? L("The voice session expired.", "La session vocale a expiré.")
          : null;

  const send = () => {
    const t = text.trim();
    if (!t || !live) return;
    v.sendText(t);
    setText("");
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      <Glow cy={0.42} strength={0.09} />
      <View style={s.top}>
        <IconButton label={L("Switch to text", "Passer au texte")} onPress={close} style={s.topBtn}>
          <Keyboard color={colors.text} size={20} strokeWidth={1.8} />
        </IconButton>
        {v.mode === "turns" ? (
          <View style={s.modePill}>
            <T style={{ fontSize: 12, color: colors.text2 }}>{L("Take turns", "Chacun son tour")}</T>
          </View>
        ) : null}
        <IconButton label={L("Voice settings", "Réglages de la voix")} onPress={() => setSettingsOpen(true)} style={s.topBtn}>
          <SlidersHorizontal color={colors.text} size={20} strokeWidth={1.8} />
        </IconButton>
      </View>

      <Pressable
        style={s.stage}
        onPress={() => v.status === "speaking" && v.interrupt()}
        accessibilityRole={v.status === "speaking" ? "button" : undefined}
        accessibilityLabel={v.status === "speaking" ? L("Interrupt Pyrius", "Interrompre Pyrius") : undefined}
      >
        <Orb mood={mood} sphere={210} theme={settings.orbTheme} levels={v.levels} />
        <T style={s.status} accessibilityLiveRegion="polite">{label}</T>
      </Pressable>

      <Animated.View style={[{ gap: 14 }, pad]}>
        {v.problem ? (
          <Animated.View entering={FadeInDown} style={s.problem} accessibilityRole="alert">
            <T style={{ fontSize: 15, textAlign: "center" }}>{v.problem.message}</T>
            {v.problem.kind === "permission" ? (
              <PrimaryButton label={L("Open Settings", "Ouvrir les réglages")} onPress={() => Linking.openSettings()} />
            ) : (
              <PrimaryButton label={L("Try again", "Réessayer")} onPress={v.start} />
            )}
          </Animated.View>
        ) : endedText ? (
          <Animated.View entering={FadeInDown} style={s.problem}>
            <T style={{ fontSize: 15, textAlign: "center", color: colors.text2 }}>{endedText}</T>
            <PrimaryButton label={L("Talk again", "Reparler")} onPress={v.start} />
          </Animated.View>
        ) : (
          <View style={s.captions} accessibilityLiveRegion="polite">
            {v.captions.user?.text ? (
              <Animated.View key={v.captions.user.id} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                <T style={s.capUser} numberOfLines={2}>{v.captions.user.text}</T>
              </Animated.View>
            ) : null}
            {v.captions.assistant?.text ? (
              <Animated.View key={v.captions.assistant.id} entering={FadeIn.duration(200)}>
                <T style={s.capAi} numberOfLines={3}>{v.captions.assistant.text}</T>
              </Animated.View>
            ) : null}
          </View>
        )}

        {flights.length ? (
          <Animated.View entering={FadeInDown}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
              {flights.map((o) => (
                <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={L("See the flights in the chat", "Voir les vols dans la discussion")} onPress={close}>
                  <MiniFlight o={o} />
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        ) : null}

        <View style={s.bar}>
          <View style={s.ask}>
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              placeholder={L("Ask Pyrius", "Demander à Pyrius")}
              placeholderTextColor={colors.text3}
              returnKeyType="send"
              editable={live}
              style={s.askInput}
              accessibilityLabel={L("Type to Pyrius", "Écrire à Pyrius")}
            />
            {text.trim() ? (
              <Pressable accessibilityRole="button" accessibilityLabel={L("Send", "Envoyer")} onPress={send} style={s.askSend}>
                <ArrowUp color={colors.bg} size={18} strokeWidth={2.5} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: v.muted }}
            accessibilityLabel={v.muted ? L("Turn microphone on", "Activer le micro") : L("Turn microphone off", "Couper le micro")}
            onPress={() => {
              tap();
              v.setMuted(!v.muted);
            }}
            style={[s.circle, { backgroundColor: v.muted ? colors.mute : colors.surface2 }]}
          >
            {v.muted ? <MicOff color={colors.white} size={22} strokeWidth={1.9} /> : <Mic color={colors.text} size={22} strokeWidth={1.9} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={L("End voice", "Terminer la conversation vocale")} onPress={close} style={[s.circle, { backgroundColor: colors.text }]}>
            <X color={colors.bg} size={24} strokeWidth={2.2} />
          </Pressable>
        </View>
      </Animated.View>

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title={L("Voice", "Voix")}>
        <VoiceOptions note={v.active() ? L("Changes apply to your next voice session.", "Les changements s'appliquent à la prochaine session vocale.") : undefined} />
        {v.mode === "turns" ? (
          <T style={{ fontSize: 12, color: colors.text3, marginTop: 12, lineHeight: 17 }}>
            {L(
              "This build takes turns: Pyrius listens until you pause, then answers. Live, interruptible voice comes with the Pyrius app build.",
              "Cette version fonctionne chacun son tour : Pyrius écoute jusqu'à votre pause, puis répond. La voix en direct arrive avec l'application Pyrius.",
            )}
          </T>
        ) : null}
        <View style={{ height: 8 }} />
        {voice.textOnly ? <T style={{ color: colors.warning, fontSize: 13 }}>{L("Text-only mode is on in Settings.", "Le mode texte seul est activé dans les réglages.")}</T> : null}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#060709" },
  top: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  topBtn: { width: 46, height: 46, backgroundColor: colors.surface, borderRadius: 23 },
  modePill: { height: 28, paddingHorizontal: 12, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.borderSoft, justifyContent: "center" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  status: { fontSize: 15, color: colors.text2, minHeight: 22 },
  captions: { minHeight: 70, paddingHorizontal: 28, gap: 8, justifyContent: "flex-end" },
  capUser: { fontSize: 15, color: colors.text3, textAlign: "center" },
  capAi: { fontSize: 17, lineHeight: 24, color: colors.text, textAlign: "center" },
  problem: { marginHorizontal: 20, padding: 18, gap: 14, borderRadius: radii.xl, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft },
  mini: { width: 150, padding: 12, gap: 4, borderRadius: radii.lg, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft },
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  ask: { flex: 1, height: 58, borderRadius: radii.pill, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 22, paddingRight: 8 },
  askInput: { ...noOutline, flex: 1, height: "100%", color: colors.text, fontFamily: fonts.regular, fontSize: 16 },
  askSend: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  circle: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
});
