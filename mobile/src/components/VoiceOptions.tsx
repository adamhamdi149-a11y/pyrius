import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { Check, Pause, Play } from "lucide-react-native";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { toast } from "~/components/Toast";
import { apiRaw, ApiError } from "~/lib/api";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { PREVIEW_TEXT, VOICE_LIST, voiceFor, type VoiceLang } from "~/lib/voices";
import { MiniOrb } from "./MiniOrb";
import { T, tap, useAccent } from "./ui";

/** Voice previews are spoken once by the server, then kept on the phone. */
async function previewFile(id: string, lang: VoiceLang) {
  const file = new File(Paths.cache, `pyrius-voice-${id}-${lang}.mp3`);
  if (file.exists && file.size) return file.uri;
  const res = await apiRaw("/api/voice/speak", { text: PREVIEW_TEXT[lang], voice: id, language: lang });
  const bytes = new Uint8Array(await res.arrayBuffer());
  file.create({ overwrite: true });
  file.write(bytes);
  return file.uri;
}

/** Rings that breathe out of the orb while a preview plays. */
function Halo({ on, color }: { on: boolean; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = on ? withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }), -1, false) : withTiming(0, { duration: 200 });
  }, [on, p]);
  const st = useAnimatedStyle(() => ({ opacity: on ? 0.5 * (1 - p.value) : 0, transform: [{ scale: 1 + p.value * 0.45 }] }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 999, borderWidth: 2, borderColor: color }, st]} />;
}

/**
 * The voice picker, after ChatGPT's: swipe through the voices, hear each one, keep the one you like.
 * Pyrius uses one voice when it speaks English and one when it speaks French; each voice speaks both.
 */
export function VoiceOptions({ note }: { note?: string }) {
  const { L, voice, updateVoice, settings } = useStore();
  const accent = useAccent();
  const { width } = useWindowDimensions();
  const card = width - 40;
  const [lang, setLang] = useState<VoiceLang>(settings.locale === "fr" ? "fr" : "en");
  const chosen = voiceFor(voice, lang);
  const [page, setPage] = useState(() => Math.max(0, VOICE_LIST.findIndex((v) => v.id === chosen)));
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const player = useRef<AudioPlayer | null>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  const stopPreview = () => {
    player.current?.remove();
    player.current = null;
    setPlaying(null);
  };
  useEffect(() => () => player.current?.remove(), []);

  // Switching language shows that language's voice.
  const switchLang = (l: VoiceLang) => {
    stopPreview();
    setLang(l);
    const i = Math.max(0, VOICE_LIST.findIndex((v) => v.id === voiceFor(voice, l)));
    setPage(i);
    requestAnimationFrame(() => scroller.current?.scrollTo({ x: i * card, animated: true }));
  };

  const preview = async (id: string) => {
    if (playing === id) return stopPreview();
    stopPreview();
    setLoading(id);
    try {
      const uri = await previewFile(id, lang);
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
      const p = createAudioPlayer(uri);
      player.current = p;
      p.addListener("playbackStatusUpdate", (st) => {
        if (st.didJustFinish) stopPreview();
      });
      p.play();
      setPlaying(id);
    } catch (e) {
      toast({ tone: "error", title: e instanceof ApiError ? e.message : L("Couldn't play this voice", "Impossible de faire entendre cette voix") });
    } finally {
      setLoading(null);
    }
  };

  const choose = (id: string) => {
    tap();
    updateVoice(lang === "fr" ? { voiceFr: id } : { voice: id });
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / card);
    if (i !== page) {
      setPage(i);
      stopPreview();
    }
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={s.segment} accessibilityRole="tablist">
        {(["en", "fr"] as const).map((l) => (
          <Pressable
            key={l}
            accessibilityRole="tab"
            accessibilityState={{ selected: lang === l }}
            onPress={() => {
              tap();
              switchLang(l);
            }}
            style={[s.segBtn, lang === l && { backgroundColor: colors.surface3 }]}
          >
            <T weight="medium" style={{ fontSize: 14, color: lang === l ? colors.text : colors.text2 }}>{l === "en" ? L("English voice", "Voix anglaise") : L("French voice", "Voix française")}</T>
          </Pressable>
        ))}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        contentOffset={{ x: page * card, y: 0 }}
        style={{ marginHorizontal: -20 }}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        snapToInterval={card}
        decelerationRate="fast"
      >
        {VOICE_LIST.map((v) => {
          const on = chosen === v.id;
          return (
            <View key={v.id} style={{ width: card, paddingHorizontal: 4 }}>
              <View style={[s.card, on && { borderColor: accent.line }]}>
                <Pressable onPress={() => preview(v.id)} accessibilityRole="button" accessibilityLabel={L(`Hear ${v.name}`, `Écouter ${v.name}`)} style={s.orbWrap}>
                  <Halo on={playing === v.id} color={accent.hi} />
                  <MiniOrb theme={settings.orbTheme} size={112} />
                  <View style={s.playBadge}>
                    {loading === v.id ? <ActivityIndicator size="small" color={colors.text} /> : playing === v.id ? <Pause color={colors.text} size={16} fill={colors.text} /> : <Play color={colors.text} size={16} fill={colors.text} />}
                  </View>
                </Pressable>
                <T weight="semibold" style={{ fontSize: 22, letterSpacing: -0.4 }}>{v.name}</T>
                <T style={{ fontSize: 14, color: colors.text2 }}>{settings.locale === "fr" ? v.fr : v.en}</T>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => choose(v.id)}
                  style={[s.use, on ? { backgroundColor: accent.accent } : { backgroundColor: colors.surface2 }]}
                >
                  {on ? <Check color={accent.ink} size={16} strokeWidth={2.6} /> : null}
                  <T weight="semibold" style={{ fontSize: 15, color: on ? accent.ink : colors.text }}>{on ? L("Selected", "Choisie") : L("Use this voice", "Choisir cette voix")}</T>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={s.dots} accessibilityElementsHidden>
        {VOICE_LIST.map((v, i) => (
          <View key={v.id} style={[s.dot, i === page && { backgroundColor: colors.text, width: 16 }]} />
        ))}
      </View>
      <T style={{ fontSize: 12, color: colors.text3, textAlign: "center" }}>
        {L("Swipe to browse. Tap the orb to hear a voice.", "Balayez pour parcourir. Touchez l'orbe pour écouter.")}
      </T>

      <View style={s.switchRow}>
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: 16 }}>{L("Spoken replies", "Réponses à voix haute")}</T>
          <T style={{ fontSize: 13, color: colors.text3 }}>{L("Off: Pyrius answers in text while you speak.", "Désactivé : Pyrius répond par écrit pendant que vous parlez.")}</T>
        </View>
        <Switch value={voice.spoken} onValueChange={(v) => updateVoice({ spoken: v })} trackColor={{ true: accent.accent, false: colors.surface3 }} thumbColor={colors.white} ios_backgroundColor={colors.surface3} accessibilityLabel={L("Spoken replies", "Réponses à voix haute")} />
      </View>
      {note ? <T style={{ fontSize: 12, color: colors.text3 }}>{note}</T> : null}
    </View>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: "row", padding: 4, borderRadius: radii.pill, backgroundColor: colors.surface },
  segBtn: { flex: 1, height: 38, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  card: { alignItems: "center", gap: 6, paddingVertical: 22, paddingHorizontal: 18, borderRadius: radii.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  orbWrap: { width: 132, height: 132, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  playBadge: { position: "absolute", right: 6, bottom: 6, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  use: { marginTop: 14, height: 44, paddingHorizontal: 20, borderRadius: radii.pill, flexDirection: "row", alignItems: "center", gap: 8 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
});
