import { router } from "expo-router";
import { BellRing, Bookmark, Plus, Search, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Conversation } from "@/lib/types";
import { useStore } from "~/lib/store";
import { colors, fonts, radii } from "~/lib/theme";
import { MiniOrb } from "./MiniOrb";
import { IconButton, T, tap, useAccent } from "./ui";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** Initials for the avatar: from the name, else the email. */
function initials(name: string, email?: string) {
  const src = name.trim() || email?.split("@")[0] || "";
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "P") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/**
 * The side menu, after Claude's layout: brand and search at the top, a couple of places, recent
 * conversations, then your profile bottom left and a new conversation bottom right.
 */
export function Drawer({ open, onClose, onNew }: { open: boolean; onClose: () => void; onNew: () => void }) {
  const { L, conversations, activeId, setActiveId, deleteConversation, settings, auth } = useStore();
  const accent = useAccent();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panel = Math.min(340, width * 0.86);
  const x = useSharedValue(-panel);
  const [mounted, setMounted] = useState(open);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (open) setMounted(true);
    x.value = withTiming(open ? 0 : -panel, { duration: open ? 420 : 260, easing: EASE }, (done) => {
      if (done && !open) scheduleOnRN(setMounted, false);
    });
  }, [open, panel, x]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((e) => {
      x.value = Math.min(0, e.translationX);
    })
    .onEnd((e) => {
      if (e.translationX < -panel * 0.3 || e.velocityX < -600) scheduleOnRN(onClose);
      else x.value = withTiming(0, { duration: 220, easing: EASE });
    });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shade = useAnimatedStyle(() => ({ opacity: 1 + x.value / panel }));

  const recent = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => c.messages.length && (!q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q))));
  }, [conversations, query]);

  if (!mounted) return null;

  const openConv = (c: Conversation) => {
    tap();
    setActiveId(c.id);
    onClose();
  };
  const go = (path: "/saved" | "/tracking" | "/settings") => {
    onClose();
    router.push(path);
  };
  const remove = (c: Conversation) =>
    Alert.alert(L("Delete this conversation?", "Supprimer cette conversation ?"), c.title, [
      { text: L("Cancel", "Annuler"), style: "cancel" },
      { text: L("Delete", "Supprimer"), style: "destructive", onPress: () => deleteConversation(c.id) },
    ]);

  const email = auth.mode === "cloud" ? auth.email : undefined;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, shade]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={L("Close menu", "Fermer le menu")} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[s.panel, { width: panel, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 14 }, panelStyle]} accessibilityViewIsModal>
          <View style={s.brandRow}>
            {searching ? (
              <View style={s.search}>
                <Search color={colors.text3} size={17} />
                <TextInput value={query} onChangeText={setQuery} autoFocus placeholder={L("Search conversations", "Rechercher")} placeholderTextColor={colors.text3} style={s.searchInput} accessibilityLabel={L("Search conversations", "Rechercher dans les conversations")} />
                <IconButton
                  label={L("Close search", "Fermer la recherche")}
                  onPress={() => {
                    setSearching(false);
                    setQuery("");
                  }}
                  style={{ width: 36, height: 36 }}
                >
                  <X color={colors.text2} size={18} />
                </IconButton>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <MiniOrb theme={settings.orbTheme} size={24} />
                  <T weight="medium" style={{ fontSize: 26, letterSpacing: -0.6 }}>Pyrius</T>
                </View>
                <IconButton label={L("Search conversations", "Rechercher")} onPress={() => setSearching(true)}>
                  <Search color={colors.text} size={21} strokeWidth={1.8} />
                </IconButton>
              </>
            )}
          </View>

          <View style={{ gap: 2, marginTop: 18 }}>
            <Pressable accessibilityRole="button" onPress={() => go("/saved")} style={({ pressed }) => [s.item, pressed && s.pressed]}>
              <Bookmark color={colors.text2} size={20} strokeWidth={1.7} />
              <T style={s.itemText}>{L("Saved offers", "Offres enregistrées")}</T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => go("/tracking")} style={({ pressed }) => [s.item, pressed && s.pressed]}>
              <BellRing color={colors.text2} size={20} strokeWidth={1.7} />
              <T style={s.itemText}>{L("Price tracking", "Suivi des prix")}</T>
            </Pressable>
          </View>

          <View style={s.rule} />
          <T style={s.section}>{L("Recent", "Récents")}</T>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
            {recent.length === 0 ? (
              <T style={{ color: colors.text3, fontSize: 14, paddingHorizontal: 12, paddingTop: 6 }}>{query ? L("No matches.", "Aucun résultat.") : L("Your trips will appear here.", "Vos voyages apparaîtront ici.")}</T>
            ) : (
              recent.map((c) => (
                <Pressable key={c.id} accessibilityRole="button" accessibilityHint={L("Long press to delete", "Appui long pour supprimer")} onPress={() => openConv(c)} onLongPress={() => remove(c)} style={({ pressed }) => [s.conv, (pressed || c.id === activeId) && s.pressed]}>
                  <T numberOfLines={1} style={{ fontSize: 16, color: c.id === activeId ? colors.text : colors.text2 }}>{c.title}</T>
                </Pressable>
              ))
            )}
          </ScrollView>

          <View style={[s.bottom, { bottom: insets.bottom + 14 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={L("Profile and settings", "Profil et réglages")} onPress={() => go("/settings")} style={[s.avatar, { backgroundColor: accent.accent }]}>
              <T weight="semibold" style={{ color: accent.ink, fontSize: 16 }}>{initials(settings.name, email)}</T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                tap();
                onNew();
                onClose();
              }}
              style={({ pressed }) => [s.newChat, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Plus color={colors.bg} size={19} strokeWidth={2.2} />
              <T weight="semibold" style={{ color: colors.bg, fontSize: 16 }}>{L("New chat", "Nouvelle discussion")}</T>
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: colors.sidebar, borderRightWidth: 1, borderColor: colors.borderSoft, paddingHorizontal: 14 },
  brandRow: { height: 48, flexDirection: "row", alignItems: "center", paddingLeft: 10 },
  search: { flex: 1, height: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, borderRadius: radii.pill, backgroundColor: colors.surface },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15, height: "100%" },
  item: { flexDirection: "row", alignItems: "center", gap: 14, height: 50, paddingHorizontal: 12, borderRadius: radii.md },
  itemText: { fontSize: 16 },
  pressed: { backgroundColor: colors.surface },
  rule: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 14, marginHorizontal: 12 },
  section: { fontSize: 14, color: colors.text3, paddingHorizontal: 12, marginBottom: 6 },
  conv: { height: 46, justifyContent: "center", paddingHorizontal: 12, borderRadius: radii.md },
  bottom: { position: "absolute", left: 14, right: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  newChat: { height: 52, paddingHorizontal: 22, borderRadius: radii.pill, backgroundColor: colors.text, flexDirection: "row", alignItems: "center", gap: 8 },
});
