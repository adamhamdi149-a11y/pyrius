import { Image } from "expo-image";
import { ArrowUp, AudioLines, Camera, Check, FileText, Image as ImageIcon, Mic, Paperclip, Plus, SlidersHorizontal, X } from "lucide-react-native";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn } from "react-native-reanimated";
import { toast } from "~/components/Toast";
import { useDictation } from "~/lib/dictation";
import { MAX_TOTAL_BYTES, MAX_UPLOADS, pickFiles, pickPhotos, takePhoto, totalSize, UploadError, type PendingUpload } from "~/lib/uploads";
import type { QuickPrefs } from "~/lib/conversation";
import { useStore } from "~/lib/store";
import { colors, fonts, radii, noOutline } from "~/lib/theme";
import { T, tap, useAccent } from "../ui";

export interface ComposerHandle {
  focus: () => void;
  setText: (t: string) => void;
}

interface Props {
  onSend: (text: string, uploads: PendingUpload[]) => void;
  onVoice: () => void;
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

/** The + button's menu, after ChatGPT's: camera, photos and files, floating just above the chat bar. */
function AttachMenu({ open, bottom, onClose, onPick }: { open: boolean; bottom: number; onClose: () => void; onPick: (from: "camera" | "photos" | "files") => void }) {
  const { L } = useStore();
  const items: { key: "camera" | "photos" | "files"; label: string; icon: React.ReactNode }[] = [
    { key: "camera", label: L("Camera", "Appareil photo"), icon: <Camera color={colors.text} size={21} strokeWidth={1.7} /> },
    { key: "photos", label: L("Photos", "Photos"), icon: <ImageIcon color={colors.text} size={21} strokeWidth={1.7} /> },
    { key: "files", label: L("Files", "Fichiers"), icon: <Paperclip color={colors.text} size={21} strokeWidth={1.7} /> },
  ];
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={L("Close", "Fermer")} />
      {open ? (
        <Animated.View entering={ZoomIn.springify().damping(18).stiffness(260)} exiting={FadeOut.duration(120)} style={[s.menu, { bottom }]} accessibilityViewIsModal>
          {items.map((it) => (
            <Pressable
              key={it.key}
              accessibilityRole="button"
              onPress={() => {
                tap();
                onClose();
                onPick(it.key);
              }}
              style={({ pressed }) => [s.menuRow, pressed && { backgroundColor: colors.surface3 }]}
            >
              <View style={s.menuIcon}>{it.icon}</View>
              <T style={{ fontSize: 17 }}>{it.label}</T>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </Modal>
  );
}

/** Thumbnails of what will be sent, each with a remove button. */
function Tray({ uploads, adding, onRemove }: { uploads: PendingUpload[]; adding: boolean; onRemove: (id: string) => void }) {
  const { L } = useStore();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tray} keyboardShouldPersistTaps="handled">
      {uploads.map((u) => (
        <Animated.View key={u.id} entering={ZoomIn.duration(160)} exiting={FadeOut.duration(120)} style={s.trayItem}>
          {u.kind === "image" ? (
            <Image source={{ uri: u.uri }} style={s.trayThumb} contentFit="cover" accessibilityLabel={u.name} />
          ) : (
            <View style={[s.trayThumb, s.trayFile]}>
              <FileText color={colors.text2} size={20} />
              <T numberOfLines={1} style={{ fontSize: 10, color: colors.text3, maxWidth: 56 }}>{u.name}</T>
            </View>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={L(`Remove ${u.name}`, `Retirer ${u.name}`)} onPress={() => onRemove(u.id)} hitSlop={8} style={s.trayX}>
            <X color={colors.text} size={12} strokeWidth={2.6} />
          </Pressable>
        </Animated.View>
      ))}
      {adding ? (
        <View style={[s.trayThumb, s.trayFile]}>
          <ActivityIndicator color={colors.text2} size="small" />
        </View>
      ) : null}
    </ScrollView>
  );
}

/**
 * The chat bar, after Claude's: a quiet pill at rest; while typing it opens into a card with the
 * trip preferences, dictation, and the send arrow, which takes the voice button's place. The +
 * button adds photos and files, shown in a tray above the text until the message is sent.
 */
export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ onSend, onVoice, onPrefs, prefs, busy, placeholder, onDraftChange, onFocusChange }, ref) {
  const { L, voice } = useStore();
  const accent = useAccent();
  const { height } = useWindowDimensions();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const box = useRef<ComponentRef<typeof View>>(null);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);

  const update = useCallback(
    (v: string, files = uploads) => {
      setText(v);
      onDraftChange?.(v.trim().length > 0 || files.length > 0);
    },
    [onDraftChange, uploads],
  );

  const openMenu = () => {
    if (uploads.length >= MAX_UPLOADS) {
      toast({ title: L(`Up to ${MAX_UPLOADS} files per message`, `Jusqu'à ${MAX_UPLOADS} fichiers par message`) });
      return;
    }
    // The menu floats just above the chat bar, wherever the keyboard has put it.
    box.current?.measureInWindow((_x, y) => setMenu(Math.max(16, height - y + 10)));
  };

  const add = async (from: "camera" | "photos" | "files") => {
    const room = MAX_UPLOADS - uploads.length;
    setAdding(true);
    try {
      const picked = from === "camera" ? [await takePhoto()].filter((u): u is PendingUpload => Boolean(u)) : from === "photos" ? await pickPhotos(room) : await pickFiles(room);
      if (!picked.length) return;
      const next = [...uploads, ...picked].slice(0, MAX_UPLOADS);
      if (totalSize(next) > MAX_TOTAL_BYTES) {
        toast({ tone: "error", title: L("That's too much for one message", "C'est trop pour un seul message"), description: L("Send fewer or smaller files.", "Envoyez moins de fichiers, ou des fichiers plus petits.") });
        return;
      }
      setUploads(next);
      onDraftChange?.(true);
    } catch (e) {
      if (__DEV__) console.warn("[uploads]", (e as Error).message);
      if (e instanceof UploadError && e.message === "camera-permission") {
        toast({ tone: "error", title: L("Camera access is off", "L'appareil photo est désactivé"), action: { label: L("Settings", "Réglages"), onPress: () => Linking.openSettings() } });
      } else {
        toast({ tone: "error", title: e instanceof UploadError ? e.message : L("That file couldn't be added", "Ce fichier n'a pas pu être ajouté") });
      }
    } finally {
      setAdding(false);
    }
  };

  const remove = (id: string) => {
    const next = uploads.filter((u) => u.id !== id);
    setUploads(next);
    onDraftChange?.(text.trim().length > 0 || next.length > 0);
  };

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

  const has = text.trim().length > 0 || uploads.length > 0;
  const open = focused || has || adding || dictation.state !== "idle";
  const active = [prefs.nonstopOnly, prefs.carryOnOnly, prefs.flexibleDates].filter(Boolean).length;
  const canSpeak = !voice.textOnly;

  const submit = () => {
    const v = text.trim();
    if ((!v && !uploads.length) || busy || adding) return;
    onSend(v, uploads);
    setUploads([]);
    update("", []);
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
    <Animated.View ref={box} layout={LinearTransition.springify().damping(22)} style={[open ? s.card : s.pill, focused && { borderColor: colors.borderStrong }]}>
      <AttachMenu open={menu !== null} bottom={menu ?? 0} onClose={() => setMenu(null)} onPick={add} />
      {uploads.length || adding ? <Tray uploads={uploads} adding={adding} onRemove={remove} /> : null}
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
          autoFocus={!text && !uploads.length}
          accessibilityLabel={placeholder}
          style={s.input}
        />
      ) : null}
      <View style={open ? s.row : s.pillRow}>
        <Round label={L("Add photos or files", "Ajouter des photos ou des fichiers")} onPress={openMenu}>
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
            <Round label={L("Send", "Envoyer")} onPress={submit} accent={has && !busy && !adding ? accent.accent : colors.surface3} disabled={!has || busy || adding}>
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
  input: { ...noOutline, color: colors.text, fontFamily: fonts.regular, fontSize: 17, lineHeight: 23, minHeight: 28, maxHeight: 150, paddingHorizontal: 8, paddingTop: 0, paddingBottom: 6, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  round: { width: 44, height: 44, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  prefs: { height: 44, paddingHorizontal: 16, borderRadius: radii.pill, backgroundColor: colors.surface2, flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  dictRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8 },
  bars: { flex: 1, height: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  menu: { position: "absolute", left: 16, minWidth: 230, padding: 8, borderRadius: 28, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, gap: 2, transformOrigin: "bottom left", boxShadow: "0 12px 40px rgba(0,0,0,0.45)" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, height: 56, paddingHorizontal: 10, paddingRight: 22, borderRadius: 20 },
  menuIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  tray: { gap: 10, paddingHorizontal: 4, paddingTop: 2, paddingBottom: 12 },
  trayItem: { position: "relative" },
  trayThumb: { width: 64, height: 64, borderRadius: radii.lg, backgroundColor: colors.surface2 },
  trayFile: { alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1, borderColor: colors.border },
  trayX: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.bg, alignItems: "center", justifyContent: "center" },
});
