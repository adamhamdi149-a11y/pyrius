import { BellOff } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { money } from "@/lib/utils";
import { Page } from "~/components/Page";
import { T, useAccent } from "~/components/ui";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";

export default function Tracking() {
  const { L, trackers, stopTracking, settings } = useStore();
  const accent = useAccent();
  return (
    <Page title={L("Price tracking", "Suivi des prix")}>
      {trackers.length === 0 ? (
        <View style={{ paddingVertical: 80 }}>
          <T style={{ fontSize: 16, color: colors.text2, textAlign: "center" }}>{L("Tap the bell on any offer to track its price.", "Touchez la cloche d'une offre pour suivre son prix.")}</T>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {trackers.map((t) => {
            const reached = t.status === "target-reached";
            return (
              <View key={t.id} style={[s.card, reached && { borderColor: accent.line }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight="medium" style={{ fontSize: 15 }} numberOfLines={1}>{t.label}</T>
                  <T style={{ fontSize: 12, color: colors.text3 }} numberOfLines={1}>{t.subLabel}</T>
                  <T style={{ fontSize: 13, color: reached ? accent.hi : colors.text2, marginTop: 4 }}>
                    {reached ? L("Target reached", "Cible atteinte") : `${L("Target", "Cible")} ${money(t.targetPrice, t.currency, settings.locale)}`}
                    {t.source === "demo" ? ` · ${L("simulated", "simulé")}` : ""}
                  </T>
                </View>
                <T weight="mono" style={{ fontSize: 17 }}>{money(t.lastKnownPrice, t.currency, settings.locale)}</T>
                <Pressable accessibilityRole="button" accessibilityLabel={L("Stop tracking", "Arrêter le suivi")} onPress={() => stopTracking(t.id)} hitSlop={8} style={s.stop}>
                  <BellOff color={colors.text3} size={17} />
                </Pressable>
              </View>
            );
          })}
          <T style={{ fontSize: 12, lineHeight: 17, color: colors.text3, marginTop: 6 }}>
            {L(
              "Live fares are saved with your target. Automatic re-checks aren't running yet: ask Pyrius to search again to see today's price.",
              "Les tarifs réels sont enregistrés avec votre cible. Les vérifications automatiques ne sont pas encore actives : demandez à Pyrius de relancer la recherche.",
            )}
          </T>
        </View>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.xl, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft },
  stop: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
