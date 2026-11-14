import { Fragment, useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { BackHandler, StyleSheet, View } from "react-native";

/**
 * Pyrius's own layer for sheets, dialogs and menus. They render inside the app's root view, above
 * every screen, instead of in a separate native window (React Native's Modal). That keeps their
 * layout identical to the screens': they respect the navigation bar and the keyboard the same way,
 * on every Android version and in Expo Go.
 */

type Layer = { id: string; node: ReactNode };
let layers: Layer[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function put(id: string, node: ReactNode) {
  const i = layers.findIndex((l) => l.id === id);
  layers = i === -1 ? [...layers, { id, node }] : layers.map((l, j) => (j === i ? { id, node } : l));
  emit();
}

function drop(id: string) {
  if (!layers.some((l) => l.id === id)) return;
  layers = layers.filter((l) => l.id !== id);
  emit();
}

let hostHeight = 0;
/** Height of the overlay layer (the app's root view), for placing menus next to what opened them. */
export const overlayHeight = () => hostHeight;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Renders its children in the overlay layer, above all screens, for as long as it's mounted. */
export function Portal({ children }: { children: ReactNode }) {
  const id = useId();
  useLayoutEffect(() => {
    put(id, children);
  });
  useLayoutEffect(() => () => drop(id), [id]);
  return null;
}

/** Placed once at the root, after the screens. */
export function OverlayHost() {
  const list = useSyncExternalStore(subscribe, () => layers, () => layers);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={(e) => (hostHeight = e.nativeEvent.layout.height)}>
      {/* No wrapper per layer: a layer's own exit animation only runs if its view is removed directly. */}
      {list.map((l) => (
        <Fragment key={l.id}>{l.node}</Fragment>
      ))}
    </View>
  );
}

/** The Android back button closes the topmost open layer first. */
export function useBackToClose(onClose: () => void, active = true) {
  const latest = useRef(onClose);
  useLayoutEffect(() => {
    latest.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      latest.current();
      return true;
    });
    return () => sub.remove();
  }, [active]);
}
