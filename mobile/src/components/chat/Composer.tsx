import { ArrowUp, AudioLines, Check, Mic, Plus, SlidersHorizontal, X } from "lucide-react-native";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn } from "react-native-reanimated";
import { useDictation } from "~/lib/dictation";
import type { QuickPrefs } from "~/lib/conversation";
import { useStore } from "~/lib/store";
import { colors, fonts, radii } from "~/lib/theme";
import { T, tap, useAccent } from "../ui";

export interface ComposerHandle {
  focus: () => void;
  setText: (t: string) => void;
}

interface Props {
  onSend: (text: string) => void;
  onVoice: () => void;
  onPlus: () => void;
  onPrefs: () => void;
  prefs: QuickPrefs;
  busy: boolean;
  /** Placeholder shown when the bar is empty. */
  placeholder: string;
  onDraftChange?: (hasText: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
}

const Round = ({ label, onPress, children, light, disabled, accent }: { label: string; onPress: () => void; children: React.ReactNode; light?: boolean; disabled?: boolean; accent?: string }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    disabled={disabled}
    hitSlop={4}
    onPress={() => {
      tap();
      onPress();
    }}
    style={({ pressed }) => [s.round, { backgroundColor: accent ?? (light ? colors.text : colors.surface3), opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }]}
  >
    {children}
  </Pressable>
);

/** Live microphone bars while dictating: they move with the real input level. */
function Bars({ levels, color }: { levels: number[]; color: string }) {
  const list = levels.length ? levels : [0];
  return (
    <View style={s.bars} accessibilityElementsHidden>
      {Array.from({ length: 28 }, (_, i) => {
        const v = list[list.length - 28 + i] ?? 0;
        return <View key={i} style={{ width: 3, borderRadius: 2, height: 4 + v * 22, backgroundColor: v > 0.05 ? color : colors.borderStrong }} />;
      })}
    </View>
  );
}

/**
 * The chat bar, after Claude's: a quiet pill at rest; while typing it opens into a card with the
 * trip preferences, dictation, and the send arrow, which takes the voice button's place.
 */
export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ onSend, onVoice, onPlus, onPrefs, prefs, busy, placeholder, onDraftChange, onFocusChange }, ref) {
  const { L, voice } = useStore();
  const accent = useAccent();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  const update = useCallback(
    (v: string) => {
      setText(v);
      onDraftChange?.(v.trim().length > 0);
    },
    [onDraftChange],
  );

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    setText: (v: string) => {
      update(v);
      requestAnimationFrame(() => input.current?.focus());
    },
  }));

  const dictation = useDictation((said) => {
    update(text ? `${text.trimEnd()} ${said}` : said);
    requestAnimationFrame(() => input.current?.focus());
  });

  const has = text.trim().length > 0;
  const open = focused || has || dictation.state !== "idle";
  const active = [prefs.nonstopOnly, prefs.carryOnOnly, prefs.flexibleDates].filter(Boolean).length;
  const canSpeak = !voice.textOnly;

  const submit = () => {
    const v = text.trim();
    if (!v || busy) return;
    onSend(v);
    update("");
  };

  if (dictation.state !== "idle") {
    return (
      <Animated.View layout={LinearTransition.springify().damping(20)} style={[s.card, { borderColor: accent.line }]}>
        <View style={s.dictRow} accessibilityLiveRegion="polite">
          {dictation.state === "recording" ? (
            <>
              <Bars levels={dictation.levels} color={accent.hi} />
              <T weight="mono" style={{ fontSize: 13, color: colors.text2 }}>{`0:${String(dictation.seconds).padStart(2, "0")}`}</T>
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.text2} size="small" />
              <T style={{ color: colors.text2, fontSize: 15 }}>{L("Writing down what you said…", "Transcription en cours…")}</T>
            </>
          )}
        </View>
        <View style={s.row}>
          <Round label={L("Cancel dictation", "Annuler la dictée")} onPress={() => dictation.stop(false)} disabled={dictation.state !== "recording"}>
            <X color={colors.text} size={20} strokeWidth={2} />
          </Round>
          <View style={{ flex: 1 }} />
          <Round label={L("Done, transcribe", "Terminé, transcrire")} onPress={() => dictation.stop(true)} accent={accent.accent} disabled={dictation.state !== "recording"}>
            <Check color={accent.ink} size={20} strokeWidth={2.6} />
          </Round>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View layout={LinearTransition.springify().damping(22)} style={[open ? s.card : s.pill, focused && { borderColor: colors.borderStrong }]}>
      {open ? (
        <TextInput
          ref={input}
          value={text}
          onChangeText={update}
          onFocus={() => {
            setFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            setFocused(false);
            onFocusChange?.(false);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.text3}
          multiline
          maxLength={2000}
          autoFocus={!has}
          accessibilityLabel={placeholder}
          style={s.input}
        />
      ) : null}
      <View style={open ? s.row : s.pillRow}>
        <Round label={L("More", "Plus")} onPress={onPlus}>
          <Plus color={colors.text} size={20} strokeWidth={1.9} />
        </Round>
        {open ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
            <Pressable accessibilityRole="button" accessibilityLabel={L("Preferences", "Préférences")} onPress={onPrefs} style={({ pressed }) => [s.prefs, pressed && { backgroundColor: colors.surface3 }]}>
              <SlidersHorizontal color={colors.text2} size={16} strokeWidth={1.8} />
              <T weight="medium" style={{ fontSize: 15, color: colors.text }}>{L("Preferences", "Préférences")}</T>
              {active > 0 ? (
                <View style={[s.badge, { backgroundColor: accent.accent }]}>
                  <T weight="semibold" style={{ fontSize: 11, color: accent.ink }}>{active}</T>
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel={placeholder} onPress={() => setFocused(true)} style={s.placeholder}>
            <T numberOfLines={1} style={{ fontSize: 17, color: colors.text3 }}>{placeholder}</T>
          </Pressable>
        )}
        {open ? <View style={{ flex: 1 }} /> : null}
        {canSpeak ? (
          <Round label={L("Dictate", "Dicter")} onPress={dictation.start}>
            <Mic color={colors.text} size={19} strokeWidth={1.8} />
          </Round>
        ) : null}
        {has || !canSpeak || !voice.enabled ? (
          <Animated.View key="send" entering={ZoomIn.duration(160)}>
            <Round label={L("Send", "Envoyer")} onPress={submit} accent={has && !busy ? accent.accent : colors.surface3} disabled={!has || busy}>
              {busy ? <ActivityIndicator color={colors.text2} size="small" /> : <ArrowUp color={has ? accent.ink : colors.text3} size={20} strokeWidth={2.5} />}
            </Round>
          </Animated.View>
        ) : (
          <Animated.View key="voice" entering={ZoomIn.duration(160)}>
            <Round label={L("Talk with Pyrius", "Parler avec Pyrius")} onPress={onVoice} light>
              <AudioLines color={colors.bg} size={20} strokeWidth={2} />
            </Round>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  pill: { minHeight: 64, borderRadius: radii.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, justifyContent: "center" },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  placeholder: { flex: 1, height: 44, justifyContent: "center", paddingHorizontal: 8 },
  card: { borderRadius: 30, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 12 },
  input: { color: colors.text, fontFamily: fonts.regular, fontSize: 17, lineHeight: 23, minHeight: 28, maxHeight: 150, paddingHorizontal: 8, paddingTop: 0, paddingBottom: 6, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  round: { width: 44, height: 44, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  prefs: { height: 44, paddingHorizontal: 16, borderRadius: radii.pill, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  dictRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8 },
  bars: { flex: 1, height: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
