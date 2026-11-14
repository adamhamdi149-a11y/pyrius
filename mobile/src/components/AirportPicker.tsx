import { Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { findAirport, searchAirports, type WorldAirport } from "@/lib/data/world";
import { useStore } from "~/lib/store";
import { colors, fonts, noOutline, radii } from "~/lib/theme";
import { Sheet } from "./Sheet";
import { T, tap, useAccent } from "./ui";

/** One airport in a list: code, city and country. */
export function AirportRow({ a, onPress, hint }: { a: WorldAirport; onPress: () => void; hint?: string }) {
  const accent = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a.city}, ${a.country}, ${a.code}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.surface }]}
    >
      <View style={s.code}>
        <T weight="mono" style={{ fontSize: 13, color: accent.hi }}>{a.code}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T weight="medium" style={{ fontSize: 16 }} numberOfLines={1}>{a.city}</T>
        <T style={{ fontSize: 13, color: colors.text3 }} numberOfLines={1}>{hint ? `${hint} · ${a.country}` : a.country}</T>
      </View>
    </Pressable>
  );
}

const NONE: string[] = [];

/** Search any of the ~4,000 airports with scheduled flights (the web app's own list). */
export function AirportPicker({
  open,
  onClose,
  onPick,
  title,
  initialQuery,
  exclude = NONE,
  homeCode,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (a: WorldAirport) => void;
  title: string;
  initialQuery?: string;
  exclude?: string[];
  homeCode?: string;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} tall scroll={false}>
      <PickerBody onPick={onPick} initialQuery={initialQuery} exclude={exclude} homeCode={homeCode} />
    </Sheet>
  );
}

function PickerBody({ onPick, initialQuery, exclude, homeCode }: { onPick: (a: WorldAirport) => void; initialQuery?: string; exclude: string[]; homeCode?: string }) {
  const { L } = useStore();
  const [q, setQ] = useState(initialQuery ?? "");
  const home = homeCode ? findAirport(homeCode) : undefined;
  const results = useMemo(() => searchAirports(q, 14).filter((a) => !exclude.includes(a.code)), [q, exclude]);
  const list = q.trim() ? results : home && !exclude.includes(home.code) ? [home] : [];
  return (
    <>
      <View style={s.search}>
        <Search color={colors.text3} size={18} strokeWidth={1.8} />
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus
          placeholder={L("City or airport", "Ville ou aéroport")}
          placeholderTextColor={colors.text3}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={L("City or airport", "Ville ou aéroport")}
          style={s.input}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(a) => a.code}
        keyboardShouldPersistTaps="handled"
        style={{ marginTop: 10, flex: 1 }}
        ListHeaderComponent={!q.trim() && list.length ? <T style={s.label}>{L("Your home airport", "Votre aéroport")}</T> : undefined}
        ListEmptyComponent={q.trim() ? <T style={[s.label, { marginTop: 12 }]}>{L("No airport matches that name.", "Aucun aéroport ne correspond.")}</T> : undefined}
        renderItem={({ item }) => <AirportRow a={item} onPress={() => onPick(item)} />}
      />
    </>
  );
}

const s = StyleSheet.create({
  search: { height: 52, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  input: { ...noOutline, flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 16, height: "100%" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10, paddingHorizontal: 6, borderRadius: radii.md },
  code: { width: 52, height: 36, borderRadius: radii.sm, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12, color: colors.text3, marginBottom: 6, marginLeft: 6 },
});
