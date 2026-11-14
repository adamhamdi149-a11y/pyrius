import { useSyncExternalStore, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { useBackToClose } from "./Overlay";
import { Sheet } from "./Sheet";
import { T, tap, useAccent } from "./ui";

/**
 * Pyrius's own dialogs and action menus, in place of the system alert boxes: same colours, type and
 * corners as the rest of the app. Call them from anywhere; DialogHost (at the root) shows them.
 */

export type DialogTone = "default" | "primary" | "destructive" | "cancel";
export interface DialogAction {
  label: string;
  onPress?: () => void;
  tone?: DialogTone;
  icon?: ReactNode;
}

type Open =
  | { kind: "dialog"; id: number; title: string; message?: string; actions: DialogAction[] }
  | { kind: "actions"; id: number; title?: string; subtitle?: string; actions: DialogAction[] };

let current: Open | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const set = (v: Open | null) => {
  current = v;
  listeners.forEach((l) => l());
};

/** A centred message with one to three buttons. With no actions, a single OK button closes it. */
export function showDialog(d: { title: string; message?: string; actions?: DialogAction[] }) {
  set({ kind: "dialog", id: ++seq, title: d.title, message: d.message, actions: d.actions?.length ? d.actions : [{ label: "OK", tone: "primary" }] });
}

/** A menu of choices rising from the bottom, like the share sheet. Cancel is added automatically. */
export function showActions(d: { title?: string; subtitle?: string; actions: DialogAction[] }) {
  set({ kind: "actions", id: ++seq, title: d.title, subtitle: d.subtitle, actions: d.actions });
}

/** Asks before something that can't be undone. */
export function confirmDialog(d: { title: string; message?: string; confirm: string; cancel: string; destructive?: boolean; onConfirm: () => void }) {
  showDialog({
    title: d.title,
    message: d.message,
    actions: [
      { label: d.cancel, tone: "cancel" },
      { label: d.confirm, tone: d.destructive ? "destructive" : "primary", onPress: d.onConfirm },
    ],
  });
}

export function DialogHost() {
  const open = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
  if (!open) return null;
  return open.kind === "dialog" ? <DialogBox key={open.id} d={open} /> : <ActionsSheet key={open.id} d={open} />;
}

const close = (id: number) => current?.id === id && set(null);

function run(id: number, a: DialogAction) {
  tap();
  close(id);
  // After the dialog has gone, so a follow-up dialog can open cleanly.
  if (a.onPress) setTimeout(a.onPress, 0);
}

function DialogBox({ d }: { d: Extract<Open, { kind: "dialog" }> }) {
  const accent = useAccent();
  const dismiss = () => close(d.id);
  useBackToClose(dismiss);
  const row = d.actions.length <= 2;
  return (
    <>
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, s.backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <View style={s.center} pointerEvents="box-none">
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} style={s.box} accessibilityViewIsModal accessibilityRole="alert">
          <T weight="semibold" style={s.title}>{d.title}</T>
          {d.message ? <T style={s.message}>{d.message}</T> : null}
          <View style={[s.buttons, row ? { flexDirection: "row" } : { flexDirection: "column" }]}>
            {d.actions.map((a) => {
              const tone = a.tone ?? "default";
              const bg = tone === "primary" ? accent.accent : tone === "destructive" ? colors.error : colors.surface3;
              const fg = tone === "primary" ? accent.ink : tone === "destructive" ? "#1c0507" : colors.text;
              return (
                <Pressable
                  key={a.label}
                  accessibilityRole="button"
                  onPress={() => run(d.id, a)}
                  style={({ pressed }) => [s.button, row && { flex: 1 }, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}
                >
                  <T weight="semibold" style={{ fontSize: 15, color: fg }}>{a.label}</T>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </>
  );
}

function ActionsSheet({ d }: { d: Extract<Open, { kind: "actions" }> }) {
  const { L } = useStore();
  const dismiss = () => close(d.id);
  return (
    <Sheet open onClose={dismiss} title={d.title} subtitle={d.subtitle}>
      <View style={{ gap: 2 }}>
        {d.actions.map((a) => {
          const danger = a.tone === "destructive";
          return (
            <Pressable key={a.label} accessibilityRole="button" onPress={() => run(d.id, a)} style={({ pressed }) => [s.item, pressed && { backgroundColor: colors.surface }]}>
              {a.icon ? <View style={[s.itemIcon, danger && { backgroundColor: colors.errorSoft }]}>{a.icon}</View> : null}
              <T weight="medium" style={{ fontSize: 16, color: danger ? colors.error : colors.text }}>{a.label}</T>
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" onPress={dismiss} style={({ pressed }) => [s.cancel, pressed && { opacity: 0.8 }]}>
          <T weight="medium" style={{ fontSize: 16, color: colors.text2 }}>{L("Cancel", "Annuler")}</T>
        </Pressable>
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: colors.overlay },
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  box: { width: "100%", maxWidth: 380, padding: 24, borderRadius: radii.xxl + 4, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border, gap: 8 },
  title: { fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  message: { fontSize: 15, lineHeight: 22, color: colors.text2 },
  buttons: { gap: 10, marginTop: 16 },
  button: { height: 50, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  item: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 58, paddingHorizontal: 8, borderRadius: radii.lg },
  itemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  cancel: { height: 52, marginTop: 10, borderRadius: radii.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
});
