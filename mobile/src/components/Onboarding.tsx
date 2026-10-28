import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardPadding } from "~/lib/keyboard";
import { useStore } from "~/lib/store";
import { colors } from "~/lib/theme";
import { IconButton, StepDots } from "./ui";

/** Layout shared by the setup screens: a quiet top row (back, progress), airy content, actions at the bottom. */
export function OnboardingScreen({ step, back, children, footer, background }: { step?: number; back?: boolean; children: ReactNode; footer: ReactNode; background?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { L } = useStore();
  const pad = useKeyboardPadding(28);
  return (
    <View style={[s.root, { paddingTop: insets.top + 10 }]}>
      {background}
      <View style={s.top}>
        <View style={s.side}>
          {back && router.canGoBack() ? (
            <IconButton label={L("Back", "Retour")} onPress={() => router.back()} style={{ marginLeft: -12 }}>
              <ChevronLeft color={colors.text2} size={24} strokeWidth={1.8} />
            </IconButton>
          ) : null}
        </View>
        {step ? <StepDots step={step} /> : null}
        <View style={s.side} />
      </View>
      {/* The content scrolls when space runs out (keyboard open, small phones) so it never slides under the buttons. */}
      <ScrollView style={s.body} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        {children}
      </ScrollView>
      <Animated.View style={[s.footer, pad]}>{footer}</Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 28 },
  top: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { width: 44 },
  body: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 16 },
  footer: { gap: 10, paddingTop: 8 },
});
