"use client";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { placeName } from "@/lib/data/world";
import { setCabin, setDates, setDestination, setLegs, setOrigin, setTravelers, setTripKind, swapAirports, travelersOf, tripKind } from "@/lib/flights/workflow";
import type { TripPreferences } from "@/lib/types";
import { cx } from "@/lib/utils";
import { AirportPicker } from "./AirportPicker";
import { DatesStep } from "./DatesStep";
import type { EditTarget } from "./FlowPanel";
import { MultiCityEditor } from "./MultiCityEditor";
import { CabinPicker, TravelersPicker } from "./TravelersCabin";

type Update = (t: TripPreferences) => { trip: TripPreferences; error?: string } | TripPreferences;

/** Opened from the trip summary: changes one part of the trip and keeps every other detail. */
export function TripEditor({
  target,
  trip,
  today,
  locale,
  homeCode,
  onClose,
  commit,
}: {
  target: EditTarget;
  trip: TripPreferences;
  today: string;
  locale: "en" | "fr";
  homeCode?: string;
  onClose: () => void;
  commit: (u: Update) => boolean;
}) {
  const fr = locale === "fr";
  const L = (en: string, f: string) => (fr ? f : en);
  const [side, setSide] = useState<"origin" | "destination">(target === "origin" ? "origin" : "destination");
  const route = target === "origin" || target === "destination";
  const title = route ? L("Airports", "Aéroports") : target === "dates" ? (tripKind(trip) === "multi" ? L("Your route", "Votre itinéraire") : L("Trip type and dates", "Type de voyage et dates")) : L("Travelers and cabin", "Voyageurs et classe");
  const done = (u: Update) => commit(u) && onClose();

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      wide
      footer={
        target === "travelers" ? (
          <button className="btn btn--primary" onClick={onClose}>
            {L("Done", "Terminé")}
          </button>
        ) : undefined
      }
    >
      {route && (
        <div className="editor">
          <div className="editor__route">
            <button type="button" className={cx("editor__end", side === "origin" && "is-on")} onClick={() => setSide("origin")}>
              <small>{L("From", "Départ")}</small>
              <b>{trip.originCode ? `${placeName(trip.originCode, locale)} ${trip.originCode}` : L("Choose", "Choisir")}</b>
            </button>
            <button type="button" className="icon-btn editor__swap" onClick={() => commit(swapAirports)} disabled={!trip.originCode || !trip.destinationCode} aria-label={L("Swap", "Inverser")}>
              <ArrowLeftRight />
            </button>
            <button type="button" className={cx("editor__end", side === "destination" && "is-on")} onClick={() => setSide("destination")}>
              <small>{L("To", "Destination")}</small>
              <b>{trip.destinationCode ? `${placeName(trip.destinationCode, locale)} ${trip.destinationCode}` : L("Choose", "Choisir")}</b>
            </button>
          </div>
          <AirportPicker
            key={side}
            role={side}
            locale={locale}
            homeCode={homeCode}
            initialQuery={side === "origin" ? trip.originQuery : trip.destinationQuery}
            exclude={[side === "origin" ? trip.destinationCode : trip.originCode].filter((x): x is string => Boolean(x))}
            onPick={(code) => done((t) => (side === "origin" ? setOrigin(t, code) : setDestination(t, code)))}
            autoFocus
          />
        </div>
      )}
      {target === "dates" &&
        (tripKind(trip) === "multi" ? (
          <>
            <div className="seg dates__type" role="radiogroup" aria-label={L("Trip type", "Type de voyage")}>
              {(["round", "oneway", "multi"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={k === "multi"} aria-pressed={k === "multi"} onClick={() => commit((t) => setTripKind(t, k))}>
                  {k === "round" ? L("Round trip", "Aller-retour") : k === "oneway" ? L("One way", "Aller simple") : L("Multi-city", "Multi-destinations")}
                </button>
              ))}
            </div>
            <MultiCityEditor legs={trip.legs ?? []} today={today} locale={locale} homeCode={homeCode} onConfirm={(legs) => done((t) => setLegs(t, legs))} />
          </>
        ) : (
          <DatesStep
            trip={trip}
            today={today}
            locale={locale}
            onTripKind={(k) => commit((t) => setTripKind(t, k))}
            onConfirm={(d, r) => done((t) => setDates(t, d, r, today))}
            confirmLabel={L("Apply", "Appliquer")}
          />
        ))}
      {target === "travelers" && (
        <div className="ready__edit">
          <TravelersPicker value={travelersOf(trip)} onChange={(p) => commit((t) => setTravelers(t, p))} locale={locale} />
          <CabinPicker value={trip.cabin ?? "economy"} onChange={(c) => commit((t) => setCabin(t, c))} locale={locale} />
        </div>
      )}
    </Dialog>
  );
}
