import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Bottom padding that follows the keyboard on iOS and Android, never less than the safe area plus `base`. */
export function useKeyboardPadding(base = 0) {
  const kb = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();
  return useAnimatedStyle(() => ({ paddingBottom: Math.max(insets.bottom + base, kb.height.value + 12) }));
}

/** Whether the on-screen keyboard is open, for hiding secondary content so the main action stays in view. */
export function useKeyboardVisible() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}
