import { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Bottom padding that follows the keyboard on iOS and Android, never less than the safe area plus `base`. */
export function useKeyboardPadding(base = 0) {
  const kb = useAnimatedKeyboard();
  const insets = useSafeAreaInsets();
  return useAnimatedStyle(() => ({ paddingBottom: Math.max(insets.bottom + base, kb.height.value + 12) }));
}
