"use client";
import { ArrowDownUp, BadgeDollarSign, CalendarDays, ChevronDown, Loader2, MapPin, PlaneLanding, PlaneTakeoff, Route, Search, SlidersHorizontal, Timer, Users } from "lucide-react";
import { useState } from "react";
import { findAirport } from "@/lib/data/world";
import { CABIN_LABEL, CABIN_LABEL_FR, searchProblems, travelersOf, tripKind, type FlightStep, type TripKind, type Travelers } from "@/lib/flights/workflow";
import type { Cabin, TripLeg, TripPreferences } from "@/lib/types";
import { cx, formatRange } from "@/lib/utils";
import { AirportPicker } from "./AirportPicker";
import { DatesStep } from "./DatesStep";
import { MultiCityEditor } from "./MultiCityEditor";
import { CabinPicker, TravelersPicker } from "./TravelersCabin";

export type EditTarget = "origin" | "destination" | "dates" | "travelers";
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
}

export function travelersText(t: TripPreferences, locale: "en" | "fr") {
  const fr = locale === "fr";
  const p = travelersOf(t);
  const parts = [fr ? `${p.adults} adulte${p.adults > 1 ? "s" : ""}` : `${p.adults} adult${p.adults > 1 ? "s" : ""}`];
  if (p.children) parts.push(fr ? `${p.children} enfant${p.children > 1 ? "s" : ""}` : `${p.children} child${p.children > 1 ? "ren" : ""}`);
  if (p.infants) parts.push(fr ? `${p.infants} bébé${p.infants > 1 ? "s" : ""}` : `${p.infants} infant${p.infants > 1 ? "s" : ""}`);
  return parts.join(", ");
}

export const cabinText = (t: TripPreferences, locale: "en" | "fr") => (locale === "fr" ? CABIN_LABEL_FR : CABIN_LABEL)[t.cabin ?? "economy"];

/** The control for the workflow's current step, shown under Pyrius's latest message. */
export function FlowPanel({ trip, step, today, locale, homeCode, busy, hadResults, note, h }: { trip: TripPreferences; step: FlightStep; today: string; locale: "en" | "fr"; homeCode?: string; busy: boolean; hadResults: boolean; note?: string | null; h: FlowHandlers }) {
  const fr = locale === "fr";
  const L = (en: string, f: string) => (fr ? f : en);

  if (step === "results") {
    const items: { label: string; icon: typeof Search; run: () => void }[] = [
      { label: L("Cheapest", "Le moins cher"), icon: BadgeDollarSign, run: () => h.onSort("price") },
      { label: L("Fastest", "Le plus rapide"), icon: Timer, run: () => h.onSort("duration") },
      { label: L("Fewest stops", "Moins d'escales"), icon: Route, run: () => h.onSort("stops") },
      { label: L("Change dates", "Changer les dates"), icon: CalendarDays, run: () => h.onEdit("dates") },
      { label: L("Edit airports", "Modifier les aéroports"), icon: MapPin, run: () => h.onEdit(tripKind(trip) === "multi" ? "dates" : "destination") },
    ];
    return (
      <div className="flow flow--chips" role="group" aria-label={L("Refine these results", "Affiner ces résultats")}>
        {items.map(({ label, icon: Icon, run }, i) => (
          <button key={label} type="button" className="chip m-press" style={{ animationDelay: `${i * 40}ms` }} onClick={run}>
            <Icon />
            {label}
          </button>
        ))}
      </div>
    );
  }

  const head = {
    destination: [PlaneLanding, L("Destination", "Destination")],
    origin: [PlaneTakeoff, L("Departure airport", "Aéroport de départ")],
    dates: [CalendarDays, L("Trip type and dates", "Type de voyage et dates")],
    legs: [Route, L("Your route", "Votre itinéraire")],
    ready: [Search, L("Ready to search", "Prêt à chercher")],
  }[step] as [typeof Search, string];
  const [Icon, title] = head;

  return (
    <section className="flow" aria-label={title}>
      <div className="flow__head">
        <span className="flow__icon">
          <Icon />
        </span>
        <span className="flow__title">{title}</span>
      </div>
      {note && (
        <p className="flow__note" role="alert">
          {note}
        </p>
      )}
      {step === "destination" && (
        <AirportPicker key={`d-${trip.destinationQuery ?? ""}`} role="destination" locale={locale} initialQuery={trip.destinationQuery} exclude={trip.originCode ? [trip.originCode] : []} onPick={h.onDestination} autoFocus />
      )}
      {step === "origin" && (
        <AirportPicker key={`o-${trip.originQuery ?? ""}`} role="origin" locale={locale} initialQuery={trip.originQuery} exclude={trip.destinationCode ? [trip.destinationCode] : []} homeCode={homeCode} onPick={h.onOrigin} autoFocus />
      )}
      {step === "dates" && <DatesStep trip={trip} today={today} locale={locale} onTripKind={h.onTripKind} onConfirm={h.onDates} />}
      {step === "legs" && (
        <>
          <div className="seg dates__type" role="radiogroup" aria-label={L("Trip type", "Type de voyage")}>
            {(["round", "oneway", "multi"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={k === "multi"} aria-pressed={k === "multi"} onClick={() => h.onTripKind(k)}>
                {k === "round" ? L("Round trip", "Aller-retour") : k === "oneway" ? L("One way", "Aller simple") : L("Multi-city", "Multi-destinations")}
              </button>
            ))}
          </div>
          <MultiCityEditor legs={trip.legs ?? []} today={today} locale={locale} homeCode={homeCode} onConfirm={h.onLegs} />
        </>
      )}
      {step === "ready" && <SearchCard trip={trip} today={today} locale={locale} busy={busy} again={hadResults} h={h} />}
    </section>
  );
}

function SearchCard({ trip, today, locale, busy, again, h }: { trip: TripPreferences; today: string; locale: "en" | "fr"; busy: boolean; again: boolean; h: FlowHandlers }) {
  const fr = locale === "fr";
  const L = (en: string, f: string) => (fr ? f : en);
  const [open, setOpen] = useState(!trip.confirmed?.travelers && !trip.adults);
  const problems = searchProblems(trip, today).filter((p) => !p.startsWith("missing:"));
  const multi = tripKind(trip) === "multi";
  const city = (c?: string) => findAirport(c)?.city ?? c ?? "";
  const route = multi ? (trip.legs ?? []).map((l) => l.from).concat(trip.legs?.at(-1)?.to ?? []).join(" → ") : `${trip.originCode} → ${trip.destinationCode}`;
  const routeCities = multi ? "" : `${city(trip.originCode)} → ${city(trip.destinationCode)}`;
  const dates = multi ? `${trip.legs?.length} ${L("flights", "vols")}` : formatRange(trip.departDate!, tripKind(trip) === "round" ? trip.returnDate : undefined, locale);
  const defaults = !trip.confirmed?.travelers && !trip.adults;

  return (
    <div className="ready">
      <div className="ready__route">
        <b className="num">{route}</b>
        {routeCities && <span>{routeCities}</span>}
        <span>
          {dates}
          {tripKind(trip) === "oneway" ? ` · ${L("one way", "aller simple")}` : ""}
        </span>
      </div>
      <button type="button" className={cx("ready__who", open && "is-open")} onClick={() => setOpen((x) => !x)} aria-expanded={open}>
        <Users />
        <span>
          {travelersText(trip, locale)} · {cabinText(trip, locale)}
          {defaults && <small>{L(" · default", " · par défaut")}</small>}
        </span>
        <ChevronDown />
      </button>
      {open && (
        <div className="ready__edit">
          <TravelersPicker value={travelersOf(trip)} onChange={h.onTravelers} locale={locale} />
          <CabinPicker value={trip.cabin ?? "economy"} onChange={h.onCabin} locale={locale} />
        </div>
      )}
      {problems.length > 0 && (
        <p className="ready__problem" role="alert">
          {problems[0]}
        </p>
      )}
      <button type="button" className="btn btn--primary btn--lg ready__go" onClick={h.onSearch} disabled={busy || problems.length > 0} aria-busy={busy}>
        {busy ? <Loader2 className="spin" /> : again ? <ArrowDownUp /> : <Search />}
        {busy ? L("Searching live fares…", "Recherche des tarifs…") : again ? L("Search again", "Relancer la recherche") : L("Search flights", "Chercher des vols")}
      </button>
      <p className="ready__note">
        <SlidersHorizontal />
        {multi
          ? L("Live fares from Google Flights for each flight; each one is a separate ticket.", "Tarifs en direct de Google Flights pour chaque vol; chacun est un billet séparé.")
          : L("Live fares from Google Flights. You can refine after the results.", "Tarifs en direct de Google Flights. Vous pourrez affiner ensuite.")}
      </p>
    </div>
  );
}
