import * as WebBrowser from "expo-web-browser";
import { ExternalLink, Phone, RotateCcw } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { BookingChoice, BookingOption } from "@/lib/providers/serpapi";
import type { Currency, FlightOffer } from "@/lib/types";
import { formatDuration, formatTime, money } from "@/lib/utils";
import { api, ApiError } from "~/lib/api";
import { API_URL } from "~/lib/config";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { Sheet } from "../Sheet";
import { PrimaryButton, T, useAccent } from "../ui";

type Ready = { choices: BookingChoice[]; returnFlight?: FlightOffer };

/**
 * Booking happens with the seller. Like the web app, Pyrius adds the cheapest return for a round trip,
 * finds who sells the exact itinerary and opens the cheapest seller's page. Google's redirect needs a
 * form POST, so the app opens a small Pyrius page that submits it; the itinerary stays in the link's
 * fragment and never reaches Pyrius's server.
 */
function openSeller(req: NonNullable<BookingOption["request"]>) {
  const data = encodeURIComponent(JSON.stringify(req));
  return WebBrowser.openBrowserAsync(`${API_URL}/api/flights/handoff#${data}`, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
}

export function BookingSheet({ offer, open, onClose }: { offer: FlightOffer; open: boolean; onClose: () => void }) {
  const { L, settings } = useStore();
  const accent = useAccent();
  const [ready, setReady] = useState<Ready | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = offer.booking;

  const load = async () => {
    if (!ref) {
      setError({ message: L("This offer can't be booked from Pyrius. Search again for current options.", "Cette offre ne peut pas être réservée depuis Pyrius. Relancez la recherche."), code: "expired" });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const step = offer.returnPending && ref.departureToken ? "trip" : "options";
      const token = step === "trip" ? ref.departureToken : ref.bookingToken;
      const r = await api<Ready>("/api/flights/booking", { step, token, params: ref.params });
      setReady({ choices: r.choices ?? [], returnFlight: r.returnFlight });
    } catch (e) {
      setError({ message: (e as Error).message, code: e instanceof ApiError ? e.code : undefined });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !ready && !loading) load();
    if (!open) {
      setReady(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const best = ready?.choices[0];
  const others = ready?.choices.slice(1, 6) ?? [];

  const Ticket = ({ t, primary }: { t: BookingOption; primary?: boolean }) => (
    <View style={[s.ticket, primary && { borderColor: accent.line }]}>
      <View style={{ flex: 1 }}>
        <T weight="semibold" style={{ fontSize: 15 }}>{t.seller}</T>
        <T style={{ fontSize: 13, color: colors.text2 }}>
          {[t.leg === "returning" ? L("Return ticket", "Billet retour") : t.leg === "departing" ? L("Outbound ticket", "Billet aller") : null, t.fareName, t.isAirline ? L("Airline", "Compagnie") : null].filter(Boolean).join(" · ")}
        </T>
      </View>
      {t.price !== undefined ? <T weight="mono" style={{ fontSize: 16 }}>{money(t.price, t.currency as Currency, settings.locale)}</T> : null}
      {t.request ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`${L("Continue to", "Continuer vers")} ${t.seller}`} onPress={() => openSeller(t.request!)} hitSlop={6} style={s.go}>
          <ExternalLink color={colors.text} size={18} strokeWidth={1.8} />
        </Pressable>
      ) : t.phone ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`${L("Call", "Appeler")} ${t.seller}`} onPress={() => Linking.openURL(`tel:${t.phone}`)} hitSlop={6} style={s.go}>
          <Phone color={colors.text} size={18} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );

  const single = best && best.tickets.length === 1 ? best.tickets[0] : null;

  return (
    <Sheet open={open} onClose={onClose} title={`${L("Book", "Réserver")} ${offer.outbound.from} → ${offer.outbound.to}`} subtitle={L("Pyrius finds the lowest price and the seller. You finish on their site.", "Pyrius trouve le meilleur prix et le vendeur. Vous finalisez sur leur site.")}>
      <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
        {loading ? (
          <View style={s.center} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.text2} />
            <T style={{ color: colors.text2, fontSize: 14 }}>
              {offer.returnPending ? L("Finding the cheapest return and the best seller…", "Recherche du meilleur retour et du vendeur…") : L("Finding the best seller…", "Recherche du meilleur vendeur…")}
            </T>
          </View>
        ) : error ? (
          <View style={s.center}>
            <T style={{ color: colors.text2, fontSize: 14, textAlign: "center" }}>{error.message}</T>
            {error.code !== "expired" ? (
              <Pressable accessibilityRole="button" onPress={load} style={s.retry}>
                <RotateCcw color={colors.text} size={16} />
                <T weight="medium">{L("Try again", "Réessayer")}</T>
              </Pressable>
            ) : null}
          </View>
        ) : ready ? (
          <>
            <View style={s.trip}>
              <T style={{ fontSize: 14 }}>{`${L("Out", "Aller")} · ${offer.airline.name} · ${formatTime(offer.outbound.depart)} → ${formatTime(offer.outbound.arrive)} · ${formatDuration(offer.outbound.durationMin)}`}</T>
              {ready.returnFlight ? (
                <T style={{ fontSize: 14, color: colors.text2 }}>{`${L("Back", "Retour")} · ${ready.returnFlight.airline.name} · ${formatTime(ready.returnFlight.outbound.depart)} → ${formatTime(ready.returnFlight.outbound.arrive)}`}</T>
              ) : null}
            </View>
            {single?.request ? <PrimaryButton label={`${L("Continue to", "Continuer vers")} ${single.seller}`} onPress={() => openSeller(single.request!)} /> : null}
            {best ? (
              <View style={{ gap: 8 }}>
                <T style={s.label}>{best.tickets.length > 1 ? L("Lowest price, as two separate tickets: book both", "Meilleur prix, en deux billets séparés : réservez les deux") : L("Lowest price for this trip", "Meilleur prix pour ce voyage")}</T>
                {best.tickets.map((t, i) => <Ticket key={i} t={t} primary />)}
              </View>
            ) : (
              <T style={{ color: colors.text2 }}>{L("No seller offers this itinerary online right now.", "Aucun vendeur ne propose cet itinéraire en ligne pour l'instant.")}</T>
            )}
            {others.length ? (
              <View style={{ gap: 8 }}>
                <T style={s.label}>{L("Other sellers", "Autres vendeurs")}</T>
                {others.map((c, i) => c.tickets.map((t, j) => <Ticket key={`${i}-${j}`} t={t} />))}
              </View>
            ) : null}
          </>
        ) : null}
        <T style={s.fine}>
          {L(
            "Prices come from Google Flights and are confirmed by the seller before you pay. Pyrius doesn't sell tickets or take payment.",
            "Les prix viennent de Google Flights et sont confirmés par le vendeur avant le paiement. Pyrius ne vend pas de billets et ne prend aucun paiement.",
          )}
        </T>
      </ScrollView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  center: { alignItems: "center", gap: 12, paddingVertical: 28 },
  retry: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 16, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border },
  trip: { gap: 6, padding: 14, borderRadius: radii.lg, backgroundColor: colors.surface },
  ticket: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  go: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, color: colors.text3 },
  fine: { fontSize: 12, lineHeight: 17, color: colors.text3, marginTop: 8 },
});
