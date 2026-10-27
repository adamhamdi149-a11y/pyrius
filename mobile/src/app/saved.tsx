import { BedDouble, Car, Plane, Trash2 } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { offerTitle } from "@/lib/offers";
import { money, timeAgo } from "@/lib/utils";
import { Page } from "~/components/Page";
import { T } from "~/components/ui";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";

const ICONS = { flight: Plane, hotel: BedDouble, car: Car } as const;

export default function Saved() {
  const { L, saved, removeSaved, settings } = useStore();
  return (
    <Page title={L("Saved offers", "Offres enregistrées")}>
      {saved.length === 0 ? (
        <View style={s.empty}>
          <T style={{ fontSize: 16, color: colors.text2, textAlign: "center" }}>{L("Offers you save appear here.", "Les offres enregistrées apparaissent ici.")}</T>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {saved.map((item) => {
            const Icon = ICONS[item.kind];
            const o = item.data.offer;
            return (
              <View key={item.id} style={s.card}>
                <View style={s.icon}>
                  <Icon color={colors.text2} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <T weight="medium" style={{ fontSize: 15 }} numberOfLines={1}>{offerTitle(item.data)}</T>
                  <T style={{ fontSize: 12, color: colors.text3 }}>{`${o.source === "demo" ? L("Example", "Exemple") : L("Live fare when saved", "Tarif réel à l'enregistrement")} · ${timeAgo(item.savedAt, settings.locale)}`}</T>
                </View>
                <T weight="mono" style={{ fontSize: 16 }}>{money(o.totalPrice, o.currency, settings.locale)}</T>
                <Pressable accessibilityRole="button" accessibilityLabel={L("Remove", "Retirer")} onPress={() => removeSaved(item.id)} hitSlop={8} style={s.remove}>
                  <Trash2 color={colors.text3} size={17} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  empty: { paddingVertical: 80 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.xl, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  remove: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
