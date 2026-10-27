import { Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { searchAirports, type WorldAirport } from "@/lib/data/world";
import { useStore } from "~/lib/store";
import { colors, fonts, radii } from "~/lib/theme";
import { Sheet } from "./Sheet";
import { T, useAccent } from "./ui";

/** Search any of the ~4,000 airports with scheduled flights (the web app's own list). */
export function AirportPicker({ open, onClose, onPick, title }: { open: boolean; onClose: () => void; onPick: (a: WorldAirport) => void; title: string }) {
  const { L } = useStore();
  const accent = useAccent();
  const [q, setQ] = useState("");
  const results = useMemo(() => searchAirports(q, 12), [q]);
  return (
    <Sheet open={open} onClose={onClose} title={title} tall>
      <View style={s.search}>
        <Search color={colors.text3} size={18} strokeWidth={1.8} />
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus
          placeholder={L("City or airport", "Ville ou aéroport")}
          placeholderTextColor={colors.text3}
          autoCorrect={false}
          accessibilityLabel={L("City or airport", "Ville ou aéroport")}
          style={s.input}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(a) => a.code}
        keyboardShouldPersistTaps="handled"
        style={{ marginTop: 8 }}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => onPick(item)} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.surface }]}>
            <T weight="mono" style={{ fontSize: 15, color: accent.hi, width: 44 }}>{item.code}</T>
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 15 }}>{item.city}</T>
              <T style={{ fontSize: 13, color: colors.text3 }}>{item.country}</T>
            </View>
          </Pressable>
        )}
      />
    </Sheet>
  );
}

const s = StyleSheet.create({
  search: { height: 50, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 16, height: "100%" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: radii.md },
});
