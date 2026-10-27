"use client";
import { ArrowRight, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { MAX_DAYS_AHEAD, returnProblem, tripKind, type TripKind } from "@/lib/flights/workflow";
import type { TripPreferences } from "@/lib/types";
import { addDays, cx, daysBetween } from "@/lib/utils";
import { Calendar, shortDate } from "./Calendar";

/** Trip type and dates: the calendar stays open until the dates the trip needs are chosen. */
export function DatesStep({
  trip,
  today,
  locale,
  onTripKind,
  onConfirm,
  confirmLabel,
}: {
  trip: TripPreferences;
  today: string;
  locale: "en" | "fr";
  onTripKind: (k: TripKind) => void;
  onConfirm: (depart: string, ret: string | undefined) => void;
  confirmLabel?: string;
}) {
  const fr = locale === "fr";
  const kind = tripKind(trip);
  const [start, setStart] = useState(trip.departDate);
  const [end, setEnd] = useState(kind === "round" ? trip.returnDate : undefined);
  const [picking, setPicking] = useState<"start" | "end">(trip.departDate && !trip.returnDate ? "end" : "start");

  useEffect(() => {
    if (kind !== "round") setEnd(undefined);
  }, [kind]);

  const onChange = (s: string | undefined, e: string | undefined) => {
    setStart(s);
    setEnd(kind === "round" ? e : undefined);
    setPicking(kind === "round" && s && !e ? "end" : "start");
  };

  const ready = Boolean(start && (kind !== "round" || end));
  const nights = start && end ? daysBetween(start, end) : null;
  const problem = start && end ? returnProblem(start, end, today) : null;
  const types: [TripKind, string][] = [
    ["round", fr ? "Aller-retour" : "Round trip"],
    ["oneway", fr ? "Aller simple" : "One way"],
    ["multi", fr ? "Multi-destinations" : "Multi-city"],
  ];

  return (
    <div className="dates">
      <div className="seg dates__type" role="radiogroup" aria-label={fr ? "Type de voyage" : "Trip type"}>
        {types.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} aria-pressed={kind === k} onClick={() => onTripKind(k)}>
            {l}
          </button>
        ))}
      </div>

      <div className="dates__pills">
        <button type="button" className={cx("dates__pill", picking === "start" && "is-on", start && "is-set")} onClick={() => setPicking("start")}>
          <CalendarDays />
          <span>
            <small>{fr ? "Départ" : "Departure"}</small>
            <b>{start ? shortDate(start, locale) : fr ? "Choisir" : "Choose a date"}</b>
          </span>
        </button>
        {kind === "round" && (
          <button type="button" className={cx("dates__pill", picking === "end" && "is-on", end && "is-set")} onClick={() => start && setPicking("end")} disabled={!start}>
            <CalendarDays />
            <span>
              <small>{fr ? "Retour" : "Return"}</small>
              <b>{end ? shortDate(end, locale) : fr ? "Choisir" : "Choose a date"}</b>
            </span>
          </button>
        )}
      </div>

      <Calendar
        mode={kind === "round" ? "range" : "single"}
        start={start}
        end={end}
        picking={picking}
        min={picking === "end" && start ? start : today}
        max={addDays(today, picking === "end" ? MAX_DAYS_AHEAD + 60 : MAX_DAYS_AHEAD)}
        month={trip.calendarMonth}
        onChange={onChange}
        locale={locale}
      />

      <div className="dates__foot">
        <span className="dates__summary" aria-live="polite">
          {problem
            ? problem
            : start && kind === "round" && end
              ? fr
                ? `${nights} nuit${nights === 1 ? "" : "s"}`
                : `${nights} night${nights === 1 ? "" : "s"}`
              : start && kind === "round"
                ? fr
                  ? "Choisissez maintenant le retour"
                  : "Now pick your return"
                : !start
                  ? fr
                    ? "Choisissez votre départ"
                    : "Pick your departure"
                  : ""}
        </span>
        <button type="button" className="btn btn--primary" disabled={!ready || Boolean(problem)} onClick={() => start && onConfirm(start, kind === "round" ? end : undefined)}>
          {confirmLabel ?? (fr ? "Continuer" : "Continue")}
          <ArrowRight />
        </button>
      </div>
    </div>
  );
}
