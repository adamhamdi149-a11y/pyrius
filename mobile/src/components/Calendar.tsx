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
const monthOf = (s: string) => ({ y: Number(s.slice(0, 4)), m: Number(s.slice(5, 7)) - 1 });

/**
 * A month calendar. "single" picks one day; "range" picks a first and a last day (`picking` says
 * which one the next tap sets). Days outside min–max can't be chosen.
 */
export function Calendar({
  mode,
  start,
  end,
  picking = "start",
  min,
  max,
  month,
  onChange,
}: {
  mode: "single" | "range";
  start?: string;
  end?: string;
  picking?: "start" | "end";
  min: string;
  max?: string;
  /** Month to open on when no day is chosen yet (YYYY-MM). */
  month?: string;
  onChange: (start: string | undefined, end: string | undefined) => void;
}) {
  const { settings } = useStore();
  const accent = useAccent();
  const lang = settings.locale === "fr" ? "fr" : "en";
  const [view, setView] = useState(() => monthOf(start ?? (month ? `${month}-01` : min)));

  const days = new Date(view.y, view.m + 1, 0).getDate();
  const lead = new Date(view.y, view.m, 1).getDay();
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => iso(view.y, view.m, i + 1))];
  const shift = (n: number) => setView(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));
  const first = monthOf(min);
  const atStart = view.y < first.y || (view.y === first.y && view.m <= first.m);
  const last = max ? monthOf(max) : null;
  const atEnd = Boolean(last && (view.y > last.y || (view.y === last.y && view.m >= last.m)));

  const pick = (d: string) => {
    tap();
    if (mode === "single") return onChange(d, undefined);
    if (picking === "end" && start && d >= start) return onChange(start, d);
    // A new first day keeps the last one only if it still comes after it.
    onChange(d, end && end >= d && picking === "start" ? end : undefined);
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={s.head}>
        <IconButton label={lang === "fr" ? "Mois précédent" : "Previous month"} onPress={() => shift(-1)} disabled={atStart} style={{ opacity: atStart ? 0.25 : 1 }}>
          <ChevronLeft color={colors.text} size={20} />
        </IconButton>
        <T weight="semibold" style={{ fontSize: 16, textTransform: "capitalize" }}>{`${MONTHS[lang][view.m]} ${view.y}`}</T>
        <IconButton label={lang === "fr" ? "Mois suivant" : "Next month"} onPress={() => shift(1)} disabled={atEnd} style={{ opacity: atEnd ? 0.25 : 1 }}>
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
          const off = d < min || Boolean(max && d > max);
          const edge = d === start || d === end;
          const inside = mode === "range" && start && end && d > start && d < end;
          const band = mode === "range" && start && end && start !== end && (d === start || d === end);
          return (
            <Pressable
              key={d}
              disabled={off}
              onPress={() => pick(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: edge, disabled: off }}
              accessibilityLabel={d}
              style={[s.cell, inside && { backgroundColor: accent.soft }, band && { backgroundColor: accent.soft, ...(d === start ? s.bandStart : s.bandEnd) }]}
            >
              <View style={[s.day, edge && { backgroundColor: accent.accent }]}>
                <T style={{ fontSize: 15, color: off ? colors.borderStrong : edge ? accent.ink : colors.text }} weight={edge ? "semibold" : "regular"}>
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
  bandStart: { borderTopLeftRadius: radii.pill, borderBottomLeftRadius: radii.pill },
  bandEnd: { borderTopRightRadius: radii.pill, borderBottomRightRadius: radii.pill },
  day: { width: 40, height: 40, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
});
