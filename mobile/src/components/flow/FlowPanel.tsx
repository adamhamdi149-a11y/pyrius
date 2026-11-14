import { ArrowRight, BadgeDollarSign, CalendarDays, ChevronDown, ChevronUp, MapPin, Minus, PlaneLanding, PlaneTakeoff, Plus, Route, Search, Timer, Trash2, Users, BedDouble } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { findAirport, searchAirports, type WorldAirport } from "@/lib/data/world";
import { cabinText, travelersText } from "@/lib/flights/copy";
import {
  CABIN_LABEL,
  CABIN_LABEL_FR,
  CABINS,
  MAX_DAYS_AHEAD,
  MAX_LEGS,
  MAX_PASSENGERS,
  returnProblem,
  searchProblems,
  travelerBounds,
  travelersOf,
  tripKind,
  type FlightStep,
  type Travelers,
  type TripKind,
} from "@/lib/flights/workflow";
import type { Cabin, TripLeg, TripPreferences } from "@/lib/types";
import { addDays, daysBetween, formatRange, shortDate } from "@/lib/utils";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import { AirportPicker, AirportRow } from "../AirportPicker";
import { Calendar } from "../Calendar";
import { Sheet } from "../Sheet";
import { PrimaryButton, T, tap, useAccent } from "../ui";

export type EditTarget = "origin" | "destination" | "dates";
export type ResultSort = "price" | "duration" | "stops";

export interface FlowHandlers {
  onDestination: (code: string) => void;
  onOrigin: (code: string) => void;
  onTripKind: (k: TripKind) => void;
  onDates: (depart: string, ret: string | undefined) => void;
  onLegs: (legs: TripLeg[]) => void;
  onTravelers: (p: Travelers) => void;
  onCabin: (c: Cabin) => void;
  onSearch: () => void;
  onSort: (s: ResultSort) => void;
  onEdit: (t: EditTarget) => void;
  onHotels: () => void;
}

type Lang = "en" | "fr";

/**
 * The control for the flight workflow's current step, shown under Pyrius's latest message: the same
 * steps as the web app (lib/flights/workflow decides which). Choices move the trip forward at once,
 * without waiting for the AI.
 */
export function FlowPanel({ trip, step, today, homeCode, busy, hadResults, note, h }: { trip: TripPreferences; step: FlightStep; today: string; homeCode?: string; busy: boolean; hadResults: boolean; note?: string | null; h: FlowHandlers }) {
  const { L, settings } = useStore();
  const lang: Lang = settings.locale === "fr" ? "fr" : "en";

  if (step === "results") {
    const items: { label: string; icon: ReactNode; run: () => void }[] = [
      { label: L("Cheapest", "Le moins cher"), icon: <BadgeDollarSign color={colors.text2} size={15} />, run: () => h.onSort("price") },
      { label: L("Fastest", "Le plus rapide"), icon: <Timer color={colors.text2} size={15} />, run: () => h.onSort("duration") },
      { label: L("Fewest stops", "Moins d'escales"), icon: <Route color={colors.text2} size={15} />, run: () => h.onSort("stops") },
      { label: L("Change dates", "Changer les dates"), icon: <CalendarDays color={colors.text2} size={15} />, run: () => h.onEdit("dates") },
      { label: L("Edit airports", "Modifier les aéroports"), icon: <MapPin color={colors.text2} size={15} />, run: () => h.onEdit("destination") },
      { label: L("Hotels there", "Hôtels sur place"), icon: <BedDouble color={colors.text2} size={15} />, run: h.onHotels },
    ];
    return (
      <Animated.View entering={FadeIn.duration(250)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {items.map((it) => (
            <Pressable
              key={it.label}
              accessibilityRole="button"
              onPress={() => {
                tap();
                it.run();
              }}
              style={({ pressed }) => [s.chip, pressed && { backgroundColor: colors.surface }]}
            >
              {it.icon}
              <T style={{ fontSize: 14, color: colors.text }}>{it.label}</T>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    );
  }

  const head: Record<Exclude<FlightStep, "results">, [ReactNode, string]> = {
    destination: [<PlaneLanding key="d" color={colors.text2} size={16} />, L("Destination", "Destination")],
    origin: [<PlaneTakeoff key="o" color={colors.text2} size={16} />, L("Departure airport", "Aéroport de départ")],
    dates: [<CalendarDays key="c" color={colors.text2} size={16} />, L("Trip type and dates", "Type de voyage et dates")],
    legs: [<Route key="r" color={colors.text2} size={16} />, L("Your route", "Votre itinéraire")],
    ready: [<Search key="s" color={colors.text2} size={16} />, L("Ready to search", "Prêt à chercher")],
  };
  const [icon, title] = head[step];

  return (
    <Animated.View entering={FadeIn.duration(280)} style={s.panel}>
      <View style={s.head}>
        {icon}
        <T weight="medium" style={s.headText}>{title.toUpperCase()}</T>
      </View>
      {note ? <T style={s.note} accessibilityRole="alert">{note}</T> : null}
      {step === "destination" ? <AirportStep key={`d-${trip.destinationQuery ?? ""}`} role="destination" query={trip.destinationQuery} exclude={trip.originCode} onPick={h.onDestination} /> : null}
      {step === "origin" ? <AirportStep key={`o-${trip.originQuery ?? ""}`} role="origin" query={trip.originQuery} exclude={trip.destinationCode} homeCode={homeCode} onPick={h.onOrigin} /> : null}
      {step === "dates" ? <DatesStep trip={trip} today={today} lang={lang} onTripKind={h.onTripKind} onConfirm={h.onDates} /> : null}
      {step === "legs" ? (
        <>
          <TripKinds value="multi" onChange={h.onTripKind} />
          <LegsEditor legs={trip.legs ?? []} today={today} homeCode={homeCode} lang={lang} onConfirm={h.onLegs} />
        </>
      ) : null}
      {step === "ready" ? <ReadyCard trip={trip} today={today} lang={lang} busy={busy} again={hadResults} h={h} /> : null}
    </Animated.View>
  );
}

/* ---------------- Airports ---------------- */

function AirportStep({ role, query, exclude, homeCode, onPick }: { role: "origin" | "destination"; query?: string; exclude?: string; homeCode?: string; onPick: (code: string) => void }) {
  const { L } = useStore();
  const [open, setOpen] = useState(false);
  // A place that isn't one airport ("Japan"): its airports are offered right here.
  const matches = query ? searchAirports(query, 5).filter((a) => a.code !== exclude) : [];
  const home = role === "origin" && homeCode && homeCode !== exclude ? findAirport(homeCode) : undefined;
  const label = role === "destination" ? L("Where are you flying to?", "Où allez-vous ?") : L("Where are you flying from?", "D'où partez-vous ?");
  const pick = (a: WorldAirport) => {
    setOpen(false);
    onPick(a.code);
  };
  return (
    <View style={{ gap: 6 }}>
      <Pressable accessibilityRole="search" onPress={() => setOpen(true)} style={({ pressed }) => [s.field, pressed && { borderColor: colors.borderStrong }]}>
        <Search color={colors.text3} size={18} strokeWidth={1.8} />
        <T style={{ flex: 1, fontSize: 16, color: colors.text3 }} numberOfLines={1}>{query ? `${query}…` : L("Search a city or airport", "Chercher une ville ou un aéroport")}</T>
      </Pressable>
      {home ? <AirportRow a={home} hint={L("Home", "Domicile")} onPress={() => pick(home)} /> : null}
      {matches.map((a) => (
        <AirportRow key={a.code} a={a} onPress={() => pick(a)} />
      ))}
      <AirportPicker open={open} onClose={() => setOpen(false)} onPick={pick} title={label} initialQuery={query} exclude={exclude ? [exclude] : undefined} homeCode={role === "origin" ? homeCode : undefined} />
    </View>
  );
}

/* ---------------- Dates ---------------- */

function TripKinds({ value, onChange }: { value: TripKind; onChange: (k: TripKind) => void }) {
  const { L } = useStore();
  const items: [TripKind, string][] = [
    ["round", L("Round trip", "Aller-retour")],
    ["oneway", L("One way", "Aller simple")],
    ["multi", L("Multi-city", "Multi-villes")],
  ];
  return (
    <View style={s.seg} accessibilityRole="radiogroup">
      {items.map(([k, label]) => (
        <Pressable
          key={k}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === k }}
          onPress={() => {
            if (value === k) return;
            tap();
            onChange(k);
          }}
          style={[s.segItem, value === k && s.segOn]}
        >
          <T weight={value === k ? "semibold" : "regular"} style={{ fontSize: 14, color: value === k ? colors.text : colors.text2 }}>{label}</T>
        </Pressable>
      ))}
    </View>
  );
}

function DatePill({ label, value, on, onPress, disabled }: { label: string; value: string; on: boolean; onPress: () => void; disabled?: boolean }) {
  const accent = useAccent();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on, disabled }} disabled={disabled} onPress={onPress} style={[s.pill, on && { borderColor: accent.line, backgroundColor: accent.soft }, disabled && { opacity: 0.5 }]}>
      <T style={{ fontSize: 12, color: colors.text3 }}>{label}</T>
      <T weight="medium" style={{ fontSize: 15 }} numberOfLines={1}>{value}</T>
    </Pressable>
  );
}

/** Trip type and dates: the calendar stays open until the dates the trip needs are chosen. */
export function DatesStep({ trip, today, lang, onTripKind, onConfirm, confirmLabel }: { trip: TripPreferences; today: string; lang: Lang; onTripKind: (k: TripKind) => void; onConfirm: (depart: string, ret: string | undefined) => void; confirmLabel?: string }) {
  const { L } = useStore();
  const kind = tripKind(trip);
  const round = kind === "round";
  const [start, setStart] = useState(trip.departDate);
  const [end, setEnd] = useState(round ? trip.returnDate : undefined);
  const [picking, setPicking] = useState<"start" | "end">(trip.departDate && !trip.returnDate ? "end" : "start");
  const ret = round ? end : undefined;

  const change = (a: string | undefined, b: string | undefined) => {
    setStart(a);
    setEnd(b);
    // After the departure, the next tap is the return; after the return, a tap starts over.
    setPicking(round && a && (picking === "start" || !b) ? "end" : "start");
  };

  const ready = Boolean(start && (!round || ret));
  const nights = start && ret ? daysBetween(start, ret) : null;
  const problem = start && ret ? returnProblem(start, ret, today) : null;
  const hint = problem
    ? problem
    : start && ret
      ? L(`${nights} night${nights === 1 ? "" : "s"}`, `${nights} nuit${nights === 1 ? "" : "s"}`)
      : start && round
        ? L("Now pick your return", "Choisissez maintenant le retour")
        : !start
          ? L("Pick your departure", "Choisissez votre départ")
          : "";

  return (
    <View style={{ gap: 14 }}>
      <TripKinds value={kind} onChange={onTripKind} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <DatePill label={L("Departure", "Départ")} value={start ? shortDate(start, lang) : L("Choose", "Choisir")} on={picking === "start"} onPress={() => setPicking("start")} />
        {round ? <DatePill label={L("Return", "Retour")} value={ret ? shortDate(ret, lang) : L("Choose", "Choisir")} on={picking === "end"} onPress={() => setPicking("end")} disabled={!start} /> : null}
      </View>
      <Calendar
        mode={round ? "range" : "single"}
        start={start}
        end={ret}
        picking={picking}
        min={picking === "end" && start ? start : today}
        max={addDays(today, picking === "end" ? MAX_DAYS_AHEAD + 60 : MAX_DAYS_AHEAD)}
        month={trip.calendarMonth}
        onChange={change}
      />
      <View style={s.foot}>
        <T style={{ flex: 1, fontSize: 13, color: problem ? colors.error : colors.text2 }} accessibilityLiveRegion="polite">{hint}</T>
        <ContinueButton label={confirmLabel ?? L("Continue", "Continuer")} disabled={!ready || Boolean(problem)} onPress={() => start && onConfirm(start, ret)} />
      </View>
    </View>
  );
}

function ContinueButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const accent = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [s.continue, { backgroundColor: disabled ? colors.surface3 : accent.accent, opacity: pressed ? 0.85 : 1 }]}
    >
      <T weight="semibold" style={{ fontSize: 15, color: disabled ? colors.text3 : accent.ink }}>{label}</T>
      <ArrowRight color={disabled ? colors.text3 : accent.ink} size={17} strokeWidth={2.2} />
    </Pressable>
  );
}

/* ---------------- Multi-city ---------------- */

function LegsEditor({ legs: initial, today, homeCode, lang, onConfirm }: { legs: TripLeg[]; today: string; homeCode?: string; lang: Lang; onConfirm: (legs: TripLeg[]) => void }) {
  const { L } = useStore();
  const [legs, setLegs] = useState<TripLeg[]>(initial.length >= 2 ? initial : [...initial, ...Array.from({ length: 2 - initial.length }, () => ({}))]);
  const [airport, setAirport] = useState<{ i: number; side: "from" | "to" } | null>(null);
  const [date, setDate] = useState<number | null>(null);
  const set = (i: number, patch: Partial<TripLeg>) =>
    setLegs((l) =>
      l.map((x, j) => {
        if (j === i) return { ...x, ...patch };
        // The next flight leaves from where this one lands, unless it already has its own airport.
        if (j === i + 1 && patch.to && !x.from) return { ...x, from: patch.to };
        return x;
      }),
    );
  const complete = legs.length >= 2 && legs.every((l) => l.from && l.to && l.date);
  const city = (c?: string) => (c ? findAirport(c)?.city ?? c : "");

  return (
    <View style={{ gap: 10 }}>
      {legs.map((l, i) => (
        <View key={i} style={s.leg}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <T style={{ fontSize: 12, color: colors.text3 }}>{L(`Flight ${i + 1}`, `Vol ${i + 1}`)}</T>
            {legs.length > 2 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={L("Remove this flight", "Retirer ce vol")} hitSlop={10} onPress={() => setLegs((x) => x.filter((_, j) => j !== i))}>
                <Trash2 color={colors.text3} size={16} />
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <LegButton label={L("From", "De")} value={l.from ? `${l.from} · ${city(l.from)}` : ""} onPress={() => setAirport({ i, side: "from" })} />
            <LegButton label={L("To", "À")} value={l.to ? `${l.to} · ${city(l.to)}` : ""} onPress={() => setAirport({ i, side: "to" })} />
          </View>
          <LegButton label={L("Date", "Date")} value={l.date ? shortDate(l.date, lang) : ""} onPress={() => setDate(i)} />
        </View>
      ))}
      {legs.length < MAX_LEGS ? (
        <Pressable accessibilityRole="button" onPress={() => setLegs((l) => [...l, { from: l.at(-1)?.to }])} style={s.addLeg}>
          <Plus color={colors.text2} size={16} />
          <T style={{ fontSize: 14, color: colors.text2 }}>{L("Add a flight", "Ajouter un vol")}</T>
        </Pressable>
      ) : null}
      <View style={[s.foot, { justifyContent: "flex-end" }]}>
        <ContinueButton label={L("Continue", "Continuer")} disabled={!complete} onPress={() => onConfirm(legs)} />
      </View>
      <AirportPicker
        open={airport !== null}
        onClose={() => setAirport(null)}
        title={airport?.side === "from" ? L("Leaving from", "Départ de") : L("Flying to", "Arrivée à")}
        homeCode={airport?.side === "from" ? homeCode : undefined}
        onPick={(a) => {
          if (airport) set(airport.i, { [airport.side]: a.code });
          setAirport(null);
        }}
      />
      <Sheet open={date !== null} onClose={() => setDate(null)} title={L("Flight date", "Date du vol")}>
        {date !== null ? (
          <Calendar
            mode="single"
            start={legs[date]?.date}
            min={legs[date - 1]?.date ?? today}
            max={addDays(today, MAX_DAYS_AHEAD)}
            onChange={(d) => {
              set(date, { date: d });
              setDate(null);
            }}
          />
        ) : null}
      </Sheet>
    </View>
  );
}

function LegButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const { L } = useStore();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.legBtn, pressed && { borderColor: colors.borderStrong }]}>
      <T style={{ fontSize: 11, color: colors.text3 }}>{label}</T>
      <T weight="medium" style={{ fontSize: 14, color: value ? colors.text : colors.text3 }} numberOfLines={1}>{value || L("Choose", "Choisir")}</T>
    </Pressable>
  );
}

/* ---------------- Ready to search ---------------- */

function Stepper({ label, hint, value, canAdd, canRemove, onChange }: { label: string; hint: string; value: number; canAdd: boolean; canRemove: boolean; onChange: (n: number) => void }) {
  const { L } = useStore();
  return (
    <View style={s.paxRow}>
      <View style={{ flex: 1 }}>
        <T weight="medium" style={{ fontSize: 15 }}>{label}</T>
        <T style={{ fontSize: 12, color: colors.text3 }}>{hint}</T>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${L("Remove", "Retirer")} ${label}`} disabled={!canRemove} onPress={() => (tap(), onChange(value - 1))} style={[s.step, !canRemove && { opacity: 0.35 }]}>
        <Minus color={colors.text} size={16} />
      </Pressable>
      <T weight="mono" style={{ width: 28, textAlign: "center", fontSize: 16 }}>{value}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`${L("Add", "Ajouter")} ${label}`} disabled={!canAdd} onPress={() => (tap(), onChange(value + 1))} style={[s.step, !canAdd && { opacity: 0.35 }]}>
        <Plus color={colors.text} size={16} />
      </Pressable>
    </View>
  );
}

function ReadyCard({ trip, today, lang, busy, again, h }: { trip: TripPreferences; today: string; lang: Lang; busy: boolean; again: boolean; h: FlowHandlers }) {
  const { L } = useStore();
  const accent = useAccent();
  const defaults = !trip.confirmed?.travelers && !trip.adults;
  const [open, setOpen] = useState(false);
  const pax = travelersOf(trip);
  const b = travelerBounds(pax);
  const problems = searchProblems(trip, today).filter((p) => !p.startsWith("missing:"));
  const multi = tripKind(trip) === "multi";
  const city = (c?: string) => findAirport(c)?.city ?? c ?? "";
  const codes = multi ? [trip.legs?.[0]?.from, ...(trip.legs ?? []).map((l) => l.to)].filter(Boolean).join(" → ") : `${trip.originCode}  →  ${trip.destinationCode}`;
  const cities = multi ? "" : `${city(trip.originCode)} → ${city(trip.destinationCode)}`;
  const dates = multi ? L(`${trip.legs?.length} flights`, `${trip.legs?.length} vols`) : formatRange(trip.departDate!, tripKind(trip) === "round" ? trip.returnDate : undefined, lang);
  const labels = lang === "fr" ? CABIN_LABEL_FR : CABIN_LABEL;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <T weight="mono" style={{ fontSize: 22, letterSpacing: 0.5 }}>{codes}</T>
        {cities ? <T style={{ fontSize: 14, color: colors.text2 }}>{cities}</T> : null}
        <T style={{ fontSize: 14, color: colors.text2 }}>{`${dates}${tripKind(trip) === "oneway" ? L(" · one way", " · aller simple") : ""}`}</T>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((x) => !x)} style={s.who}>
        <Users color={colors.text2} size={17} />
        <T style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>
          {`${travelersText(trip, lang)} · ${cabinText(trip, lang)}`}
          {defaults ? <T style={{ fontSize: 13, color: colors.text3 }}>{L("  default", "  par défaut")}</T> : null}
        </T>
        {open ? <ChevronUp color={colors.text2} size={18} /> : <ChevronDown color={colors.text2} size={18} />}
      </Pressable>
      {open ? (
        <View style={{ gap: 4 }}>
          <Stepper label={L("Adults", "Adultes")} hint={L("12+", "12 ans et plus")} value={pax.adults} canAdd={b.adults.add} canRemove={b.adults.remove} onChange={(n) => h.onTravelers({ ...pax, adults: n })} />
          <Stepper label={L("Children", "Enfants")} hint={L("Ages 2–11", "2 à 11 ans")} value={pax.children} canAdd={b.children.add} canRemove={b.children.remove} onChange={(n) => h.onTravelers({ ...pax, children: n })} />
          <Stepper label={L("Infants", "Bébés")} hint={L("Under 2, on a lap", "Moins de 2 ans, sur les genoux")} value={pax.infants} canAdd={b.infants.add} canRemove={b.infants.remove} onChange={(n) => h.onTravelers({ ...pax, infants: n })} />
          <T style={{ fontSize: 12, color: colors.text3, marginVertical: 6 }}>{L(`Up to ${MAX_PASSENGERS} travelers, one adult for each lap infant.`, `Jusqu'à ${MAX_PASSENGERS} voyageurs, un adulte par bébé.`)}</T>
          <View style={s.cabins}>
            {CABINS.map((c) => {
              const on = (trip.cabin ?? "economy") === c;
              return (
                <Pressable key={c} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => (tap(), h.onCabin(c))} style={[s.cabin, on && { borderColor: accent.line, backgroundColor: accent.soft }]}>
                  <T weight={on ? "semibold" : "regular"} style={{ fontSize: 13, color: on ? colors.text : colors.text2 }}>{labels[c]}</T>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      {problems.length ? <T style={{ fontSize: 13, color: colors.error }} accessibilityRole="alert">{problems[0]}</T> : null}
      {busy ? (
        <View style={[s.searching, { borderColor: accent.line }]}>
          <ActivityIndicator color={accent.hi} />
          <T style={{ fontSize: 15, color: colors.text2 }}>{L("Searching live fares…", "Recherche des tarifs en direct…")}</T>
        </View>
      ) : (
        <PrimaryButton label={again ? L("Search again", "Relancer la recherche") : L("Search flights", "Chercher des vols")} onPress={h.onSearch} disabled={problems.length > 0} />
      )}
      <T style={{ fontSize: 12, lineHeight: 17, color: colors.text3, textAlign: "center" }}>
        {multi
          ? L("Live fares from Google Flights for each flight; each one is a separate ticket.", "Tarifs en direct de Google Flights pour chaque vol; chacun est un billet séparé.")
          : L("Live fares from Google Flights. You can refine after the results.", "Tarifs en direct de Google Flights. Vous pourrez affiner ensuite.")}
      </T>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { gap: 14, padding: 18, borderRadius: radii.xxl, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  headText: { fontSize: 11, letterSpacing: 1.2, color: colors.text2 },
  note: { fontSize: 13, lineHeight: 19, color: colors.error },
  field: { height: 52, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 },
  seg: { flexDirection: "row", padding: 4, borderRadius: radii.pill, backgroundColor: colors.surface },
  segItem: { flex: 1, height: 38, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: colors.surface3 },
  pill: { flex: 1, gap: 2, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  foot: { flexDirection: "row", alignItems: "center", gap: 12 },
  continue: { height: 46, paddingHorizontal: 20, borderRadius: radii.pill, flexDirection: "row", alignItems: "center", gap: 8 },
  leg: { gap: 8, padding: 12, borderRadius: radii.lg, backgroundColor: colors.surface },
  legBtn: { flex: 1, gap: 2, paddingVertical: 9, paddingHorizontal: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg2 },
  addLeg: { height: 44, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  who: { flexDirection: "row", alignItems: "center", gap: 10, height: 50, paddingHorizontal: 14, borderRadius: radii.lg, backgroundColor: colors.surface },
  paxRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  step: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  cabins: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cabin: { height: 38, paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  searching: { height: 56, borderRadius: radii.pill, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 7 },
});

/** Changing the airports or dates after results: a sheet over the conversation. */
export function TripEditor({ target, trip, today, homeCode, onClose, onAirport, onTripKind, onDates }: { target: EditTarget | null; trip: TripPreferences; today: string; homeCode?: string; onClose: () => void; onAirport: (role: "origin" | "destination", code: string) => void; onTripKind: (k: TripKind) => void; onDates: (depart: string, ret: string | undefined) => void }) {
  const { L, settings } = useStore();
  const lang: Lang = settings.locale === "fr" ? "fr" : "en";
  const [role, setRole] = useState<"origin" | "destination" | null>(null);
  if (target === "dates") {
    return (
      <Sheet open onClose={onClose} title={L("Change dates", "Changer les dates")}>
        <DatesStep
          trip={trip}
          today={today}
          lang={lang}
          onTripKind={(k) => {
            onTripKind(k);
            // Multi-city is laid out flight by flight in the conversation itself.
            if (k === "multi") onClose();
          }}
          confirmLabel={L("Apply", "Appliquer")}
          onConfirm={(a, b) => {
            onDates(a, b);
            onClose();
          }}
        />
      </Sheet>
    );
  }
  const open = target === "origin" || target === "destination";
  const airport = (c?: string) => (c ? `${findAirport(c)?.city ?? c} (${c})` : L("Choose", "Choisir"));
  return (
    <>
      <Sheet open={open && !role} onClose={onClose} title={L("Edit airports", "Modifier les aéroports")}>
        <View style={{ gap: 10, paddingBottom: 6 }}>
          <Pressable accessibilityRole="button" onPress={() => setRole("origin")} style={s.who}>
            <PlaneTakeoff color={colors.text2} size={17} />
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 12, color: colors.text3 }}>{L("From", "De")}</T>
              <T weight="medium" style={{ fontSize: 15 }} numberOfLines={1}>{airport(trip.originCode)}</T>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setRole("destination")} style={s.who}>
            <PlaneLanding color={colors.text2} size={17} />
            <View style={{ flex: 1 }}>
              <T style={{ fontSize: 12, color: colors.text3 }}>{L("To", "À")}</T>
              <T weight="medium" style={{ fontSize: 15 }} numberOfLines={1}>{airport(trip.destinationCode)}</T>
            </View>
          </Pressable>
        </View>
      </Sheet>
      <AirportPicker
        open={open && role !== null}
        onClose={() => setRole(null)}
        title={role === "origin" ? L("Leaving from", "Départ de") : L("Flying to", "Arrivée à")}
        exclude={[role === "origin" ? trip.destinationCode : trip.originCode].filter((x): x is string => Boolean(x))}
        homeCode={role === "origin" ? homeCode : undefined}
        onPick={(a) => {
          if (role) onAirport(role, a.code);
          setRole(null);
          onClose();
        }}
      />
    </>
  );
}
