import * as WebBrowser from "expo-web-browser";
import { BedDouble, Bell, BellRing, Bookmark, BookmarkCheck, Car, ExternalLink, MapPin, Plane } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { mapSearchUrl } from "@/lib/booking";
import { findAirport } from "@/lib/data/world";
import { applyFlightFilters } from "@/lib/flights/filters";
import { suggestedTarget } from "@/lib/tracking/simulator";
import type { AnyOffer, Attachment, CarOffer, FlightOffer, FlightSegment, HotelOffer } from "@/lib/types";
import { formatDuration, formatTime, money, timeAgo } from "@/lib/utils";
import { api } from "~/lib/api";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { toast } from "../Toast";
import { T, tap, useAccent } from "../ui";
import { BookingSheet } from "./BookingSheet";

function SaveTrack({ o, conversationId }: { o: AnyOffer; conversationId?: string }) {
  const { L, isSaved, saveOffer, removeSaved, trackerFor, startTracking, stopTracking, settings } = useStore();
  const accent = useAccent();
  const saved = isSaved(o.offer.id);
  const tracker = trackerFor(o.offer.id);
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={saved ? L("Remove from saved", "Retirer des favoris") : L("Save", "Enregistrer")}
        accessibilityState={{ selected: saved }}
        onPress={() => {
          tap();
          if (saved) removeSaved(o.offer.id);
          else {
            const r = saveOffer(o, conversationId);
            toast(r.ok ? { tone: "ok", title: L("Saved", "Enregistré") } : { title: L("Plan limit reached", "Limite atteinte"), description: r.message });
          }
        }}
        style={s.act}
      >
        {saved ? <BookmarkCheck color={accent.hi} size={18} strokeWidth={1.9} /> : <Bookmark color={colors.text2} size={18} strokeWidth={1.8} />}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tracker ? L("Stop tracking", "Arrêter le suivi") : L("Track price", "Suivre le prix")}
        accessibilityState={{ selected: Boolean(tracker) }}
        onPress={() => {
          tap();
          if (tracker) return stopTracking(tracker.id);
          const target = suggestedTarget(o.offer.totalPrice);
          const r = startTracking(o, target, conversationId);
          toast(r.ok ? { tone: "ok", title: L("Tracking this price", "Suivi du prix activé"), description: `${L("Target", "Cible")} ${money(target, o.offer.currency, settings.locale)}` } : { title: L("Plan limit reached", "Limite atteinte"), description: r.message });
        }}
        style={s.act}
      >
        {tracker ? <BellRing color={accent.hi} size={18} strokeWidth={1.9} /> : <Bell color={colors.text2} size={18} strokeWidth={1.8} />}
      </Pressable>
    </View>
  );
}

function Leg({ seg }: { seg: FlightSegment }) {
  const { L } = useStore();
  return (
    <View style={s.leg}>
      <View style={{ width: 62 }}>
        <T weight="mono" style={{ fontSize: 17 }}>{formatTime(seg.depart)}</T>
        <T style={s.code}>{seg.from}</T>
      </View>
      <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
        <T style={{ fontSize: 12, color: colors.text3 }}>{formatDuration(seg.durationMin)}</T>
        <View style={s.track}>
          {seg.stopCodes.map((c) => (
            <View key={c} style={s.stopDot} />
          ))}
        </View>
        <T style={{ fontSize: 12, color: seg.stops ? colors.text2 : colors.success }}>{seg.stops ? `${seg.stops} ${seg.stops > 1 ? L("stops", "escales") : L("stop", "escale")} · ${seg.stopCodes.join(", ")}` : L("Nonstop", "Direct")}</T>
      </View>
      <View style={{ width: 62, alignItems: "flex-end" }}>
        <T weight="mono" style={{ fontSize: 17 }}>{formatTime(seg.arrive)}</T>
        <T style={s.code}>{seg.to}</T>
      </View>
    </View>
  );
}

export function FlightCard({ offer, best, conversationId, index }: { offer: FlightOffer; best?: boolean; conversationId?: string; index: number }) {
  const { L, settings } = useStore();
  const accent = useAccent();
  const [booking, setBooking] = useState(false);
  const live = offer.source === "live";
  return (
    <Animated.View entering={FadeInDown.delay(index * 70).springify().damping(20)} style={[s.card, best && { borderColor: accent.line }]} accessibilityLabel={`${offer.airline.name}, ${money(offer.totalPrice, offer.currency, settings.locale)}`}>
      <View style={s.head}>
        <View style={[s.logo, { backgroundColor: offer.airline.logo ? colors.white : offer.airline.color }]}>
          {offer.airline.logo ? <Image source={{ uri: offer.airline.logo }} style={{ width: 22, height: 22 }} accessibilityIgnoresInvertColors /> : <T weight="semibold" style={{ fontSize: 11, color: colors.white }}>{offer.airline.code}</T>}
        </View>
        <View style={{ flex: 1 }}>
          <T weight="medium" style={{ fontSize: 15 }} numberOfLines={1}>{offer.airline.name}</T>
          <T style={{ fontSize: 12, color: colors.text3 }}>{[offer.cabin, offer.outbound.flightNumber].filter(Boolean).join(" · ")}</T>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <T weight="mono" style={{ fontSize: 19 }}>{money(offer.totalPrice, offer.currency, settings.locale)}</T>
          <T style={{ fontSize: 11, color: colors.text3 }}>{offer.tripType === "oneway" || !offer.inbound && !offer.returnPending ? L("one way", "aller simple") : L("round trip", "aller-retour")}</T>
        </View>
      </View>
      <Leg seg={offer.outbound} />
      {offer.inbound ? <Leg seg={offer.inbound} /> : null}
      {offer.returnPending ? <T style={s.note}>{L("Cheapest return added when you book.", "Le retour le moins cher est ajouté à la réservation.")}</T> : null}
      <View style={s.foot}>
        <SaveTrack o={{ kind: "flight", offer }} conversationId={conversationId} />
        <View style={{ flex: 1 }} />
        {live ? (
          <Pressable accessibilityRole="button" onPress={() => setBooking(true)} style={({ pressed }) => [s.book, { backgroundColor: accent.accent, opacity: pressed ? 0.85 : 1 }]}>
            <T weight="semibold" style={{ color: accent.ink, fontSize: 14 }}>{L("Book", "Réserver")}</T>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(offer.searchUrl)} style={s.ghost}>
            <T weight="medium" style={{ fontSize: 14 }}>{L("Search this trip", "Chercher ce voyage")}</T>
            <ExternalLink color={colors.text2} size={14} />
          </Pressable>
        )}
      </View>
      {live && booking ? <BookingSheet offer={offer} open onClose={() => setBooking(false)} /> : null}
    </Animated.View>
  );
}

function FlightResults({ a, conversationId }: { a: Extract<Attachment, { type: "flights" }>; conversationId?: string }) {
  const { L, settings } = useStore();
  const [all, setAll] = useState(false);
  const snap = a.snapshot;
  const offers = useMemo(
    () => (snap ? applyFlightFilters([...snap.offers], { sort: a.filters?.sort ?? "price", stops: a.filters?.nonstopOnly ? "0" : "any", window: "any", airlines: [], maxPrice: null, carryOn: Boolean(a.filters?.carryOnOnly) }) : []),
    [snap, a.filters],
  );
  if (!snap) return <T style={s.note}>{L("These results have expired. Ask Pyrius to search again.", "Ces résultats ont expiré. Demandez à Pyrius de relancer la recherche.")}</T>;
  const cheapest = offers.reduce<FlightOffer | undefined>((m, o) => (!m || o.totalPrice < m.totalPrice ? o : m), undefined);
  const list = all ? offers : offers.slice(0, 3);
  return (
    <View style={{ gap: 10 }}>
      <View style={s.source}>
        <Plane color={colors.text3} size={13} />
        <T style={{ fontSize: 12, color: colors.text3 }}>
          {snap.source === "live"
            ? `${offers.length} ${L("flights", "vols")} · Google Flights · ${timeAgo(snap.fetchedAt, settings.locale)}`
            : `${offers.length} ${L("demo flights (examples, not real offers)", "vols de démonstration (exemples, pas de vraies offres)")}`}
        </T>
      </View>
      {list.map((o, i) => (
        <FlightCard key={o.id} offer={o} best={o.id === cheapest?.id} conversationId={conversationId} index={i} />
      ))}
      {offers.length > 3 ? (
        <Pressable accessibilityRole="button" onPress={() => setAll((x) => !x)} style={s.more}>
          <T weight="medium" style={{ fontSize: 14, color: colors.text2 }}>{all ? L("Show fewer", "Afficher moins") : L(`Show all ${offers.length}`, `Afficher les ${offers.length}`)}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

function useExamples<T>(kind: "hotels" | "cars", params: unknown) {
  const [offers, setOffers] = useState<T[] | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ offers: T[] }>(`/api/search/${kind}`, params)
      .then((r) => alive && setOffers(r.offers))
      .catch(() => alive && setOffers([]));
    return () => {
      alive = false;
    };
  }, [kind, params]);
  return offers;
}

function HotelResults({ a, conversationId }: { a: Extract<Attachment, { type: "hotels" }>; conversationId?: string }) {
  const { L, settings } = useStore();
  const offers = useExamples<HotelOffer>("hotels", a.params);
  if (!offers) return <ActivityIndicator color={colors.text2} style={{ marginVertical: 12 }} />;
  const list = [...offers].sort((x, y) => x.pricePerNight - y.pricePerNight).slice(0, 4);
  return (
    <View style={{ gap: 10 }}>
      <View style={s.source}>
        <BedDouble color={colors.text3} size={13} />
        <T style={{ fontSize: 12, color: colors.text3 }}>{L("Example stays: illustrative names and prices, not real listings", "Hébergements d'exemple : noms et prix illustratifs")}</T>
      </View>
      {list.map((h, i) => (
        <Animated.View key={h.id} entering={FadeInDown.delay(i * 70)} style={s.card}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <T weight="medium" style={{ fontSize: 15 }}>{h.name}</T>
              <T style={{ fontSize: 12, color: colors.text3 }}>{`${h.type} · ${h.neighborhood} · ${"★".repeat(h.stars)}`}</T>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <T weight="mono" style={{ fontSize: 17 }}>{money(h.pricePerNight, h.currency, settings.locale)}</T>
              <T style={{ fontSize: 11, color: colors.text3 }}>{L("per night", "par nuit")}</T>
            </View>
          </View>
          <View style={s.foot}>
            <SaveTrack o={{ kind: "hotel", offer: h }} conversationId={conversationId} />
            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(h.searchUrl)} style={s.ghost}>
              <T weight="medium" style={{ fontSize: 14 }}>Booking.com</T>
              <ExternalLink color={colors.text2} size={14} />
            </Pressable>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function CarResults({ a, conversationId }: { a: Extract<Attachment, { type: "cars" }>; conversationId?: string }) {
  const { L, settings } = useStore();
  const offers = useExamples<CarOffer>("cars", a.params);
  if (!offers) return <ActivityIndicator color={colors.text2} style={{ marginVertical: 12 }} />;
  const list = [...offers].sort((x, y) => x.totalPrice - y.totalPrice).slice(0, 4);
  return (
    <View style={{ gap: 10 }}>
      <View style={s.source}>
        <Car color={colors.text3} size={13} />
        <T style={{ fontSize: 12, color: colors.text3 }}>{L("Example rental cars: illustrative prices", "Voitures d'exemple : prix illustratifs")}</T>
      </View>
      {list.map((c, i) => (
        <Animated.View key={c.id} entering={FadeInDown.delay(i * 70)} style={s.card}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <T weight="medium" style={{ fontSize: 15 }}>{`${c.category} · ${c.supplier}`}</T>
              <T style={{ fontSize: 12, color: colors.text3 }}>{`${c.example} · ${c.seats} ${L("seats", "places")} · ${c.transmission}`}</T>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <T weight="mono" style={{ fontSize: 17 }}>{money(c.totalPrice, c.currency, settings.locale)}</T>
              <T style={{ fontSize: 11, color: colors.text3 }}>{`${c.days} ${L("days", "jours")}`}</T>
            </View>
          </View>
          <View style={s.foot}>
            <SaveTrack o={{ kind: "car", offer: c }} conversationId={conversationId} />
            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(c.searchUrl)} style={s.ghost}>
              <T weight="medium" style={{ fontSize: 14 }}>Kayak</T>
              <ExternalLink color={colors.text2} size={14} />
            </Pressable>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

export function AttachmentView({ a, conversationId }: { a: Attachment; conversationId?: string }) {
  const { L } = useStore();
  switch (a.type) {
    case "flights":
      return <FlightResults a={a} conversationId={conversationId} />;
    case "hotels":
      return <HotelResults a={a} conversationId={conversationId} />;
    case "cars":
      return <CarResults a={a} conversationId={conversationId} />;
    case "businesses": {
      const city = findAirport(a.destinationCode)?.city ?? a.destinationCode;
      return (
        <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(mapSearchUrl(`${a.category} ${city}`))} style={[s.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <MapPin color={colors.text2} size={18} />
          <T style={{ flex: 1 }}>{L(`Search ${a.category.toLowerCase()}s near ${city} on the map`, `Chercher sur la carte près de ${city}`)}</T>
          <ExternalLink color={colors.text2} size={16} />
        </Pressable>
      );
    }
  }
}

const s = StyleSheet.create({
  card: { padding: 16, gap: 14, borderRadius: radii.xl, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.borderSoft },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  leg: { flexDirection: "row", alignItems: "center", gap: 10 },
  code: { fontSize: 12, color: colors.text3, marginTop: 2 },
  track: { alignSelf: "stretch", height: 1, backgroundColor: colors.borderStrong, flexDirection: "row", justifyContent: "space-evenly", alignItems: "center" },
  stopDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.text2 },
  note: { fontSize: 12, color: colors.text3 },
  foot: { flexDirection: "row", alignItems: "center", gap: 8 },
  act: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  book: { height: 40, paddingHorizontal: 20, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  ghost: { height: 40, paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 6 },
  source: { flexDirection: "row", alignItems: "center", gap: 6 },
  more: { height: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.borderSoft },
});
