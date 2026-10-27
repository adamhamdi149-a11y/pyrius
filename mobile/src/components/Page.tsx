import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { IconButton, T } from "./ui";

/** A plain secondary screen: back button, title, scrolling content. */
export function Page({ title, children }: { title: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { L } = useStore();
  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      <View style={s.head}>
        <IconButton label={L("Back", "Retour")} onPress={() => (router.canGoBack() ? router.back() : router.replace("/chat"))} style={{ marginLeft: -8 }}>
          <ChevronLeft color={colors.text} size={26} strokeWidth={1.8} />
        </IconButton>
        <T weight="semibold" accessibilityRole="header" style={{ fontSize: 17 }}>{title}</T>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 40, gap: 28 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

export function Section({ title, children, footer }: { title: string; children: ReactNode; footer?: string }) {
  return (
    <View style={{ gap: 10 }}>
      <T style={s.section}>{title}</T>
      <View style={s.group}>{children}</View>
      {footer ? <T style={s.footer}>{footer}</T> : null}
    </View>
  );
}

export const Divider = () => <View style={{ height: 1, backgroundColor: colors.borderSoft, marginLeft: 16 }} />;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  head: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  section: { fontSize: 13, color: colors.text3, paddingHorizontal: 4 },
  group: { borderRadius: radii.xl, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft, overflow: "hidden" },
  footer: { fontSize: 12, lineHeight: 17, color: colors.text3, paddingHorizontal: 4 },
});
