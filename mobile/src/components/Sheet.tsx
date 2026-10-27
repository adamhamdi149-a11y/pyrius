import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "~/lib/theme";
import { T } from "./ui";

/** A bottom sheet: dimmed backdrop, rounded top, closes on backdrop tap or the system back button. */
export function Sheet({ open, onClose, title, subtitle, children, tall }: { open: boolean; onClose: () => void; title?: string; subtitle?: string; children: ReactNode; tall?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }, tall && { minHeight: "72%" }]} accessibilityViewIsModal>
          <View style={s.grabber} />
          {title ? <T weight="semibold" style={{ fontSize: 17, marginBottom: subtitle ? 4 : 14 }} accessibilityRole="header">{title}</T> : null}
          {subtitle ? <T style={{ fontSize: 13, color: colors.text2, marginBottom: 14 }}>{subtitle}</T> : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: { marginTop: "auto", backgroundColor: colors.bg2, borderTopLeftRadius: radii.xxl + 4, borderTopRightRadius: radii.xxl + 4, borderWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: 20, paddingTop: 10, maxHeight: "90%" },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 14 },
});
