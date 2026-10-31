import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { toISODate } from "@/lib/utils";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { IconButton, T, tap, useAccent } from "./ui";

const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
};
const DAYS = { en: ["S", "M", "T", "W", "T", "F", "S"], fr: ["D", "L", "M", "M", "J", "V", "S"] };

const iso = (y: number, m: number, d: number) => toISODate(new Date(y, m, d));

/** A month calendar for a date range: tap the first day, then the last. Past days can't be chosen. */
export function DateRange({ start, end, onChange }: { start?: string; end?: string; onChange: (start?: string, end?: string) => void }) {
  const { settings } = useStore();
  const accent = useAccent();
  const lang = settings.locale === "fr" ? "fr" : "en";
  const today = toISODate(new Date());
  const first = start ? new Date(`${start}T12:00:00`) : new Date();
  const [month, setMonth] = useState({ y: first.getFullYear(), m: first.getMonth() });

  const days = new Date(month.y, month.m + 1, 0).getDate();
  const lead = new Date(month.y, month.m, 1).getDay();
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => iso(month.y, month.m, i + 1))];
  const shift = (n: number) => setMonth(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const atStart = month.y === new Date().getFullYear() && month.m === new Date().getMonth();

  const pick = (d: string) => {
    tap();
    if (!start || end || d < start) onChange(d, undefined);
    else onChange(start, d);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={s.head}>
        <IconButton label={lang === "fr" ? "Mois précédent" : "Previous month"} onPress={() => shift(-1)} disabled={atStart} style={{ opacity: atStart ? 0.3 : 1 }}>
          <ChevronLeft color={colors.text} size={20} />
        </IconButton>
        <T weight="semibold" style={{ fontSize: 16 }}>{`${MONTHS[lang][month.m]} ${month.y}`}</T>
        <IconButton label={lang === "fr" ? "Mois suivant" : "Next month"} onPress={() => shift(1)}>
          <ChevronRight color={colors.text} size={20} />
        </IconButton>
      </View>
      <View style={s.row}>
        {DAYS[lang].map((d, i) => (
          <T key={i} style={s.dow}>{d}</T>
        ))}
      </View>
      <View style={s.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={s.cell} />;
          const past = d < today;
          const edge = d === start || d === end;
          const inside = start && end && d > start && d < end;
          return (
            <Pressable
              key={d}
              disabled={past}
              onPress={() => pick(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: edge, disabled: past }}
              accessibilityLabel={d}
              style={[s.cell, inside && { backgroundColor: accent.soft }]}
            >
              <View style={[s.day, edge && { backgroundColor: accent.accent }]}>
                <T style={{ fontSize: 15, color: past ? colors.borderStrong : edge ? accent.ink : colors.text }} weight={edge ? "semibold" : "regular"}>
                  {Number(d.slice(8))}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row" },
  dow: { width: `${100 / 7}%`, textAlign: "center", fontSize: 12, color: colors.text3 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: "center", justifyContent: "center" },
  day: { width: 40, height: 40, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
});
