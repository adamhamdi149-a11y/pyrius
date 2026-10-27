"use client";
import { ArrowRight, CalendarDays, Plus, X } from "lucide-react";
import { useState } from "react";
import { findAirport } from "@/lib/data/world";
import { MAX_DAYS_AHEAD, MAX_LEGS } from "@/lib/flights/workflow";
import type { TripLeg } from "@/lib/types";
import { addDays, cx } from "@/lib/utils";
import { AirportPicker } from "./AirportPicker";
import { Calendar, shortDate } from "./Calendar";

type Editing = { leg: number; field: "from" | "to" | "date" } | null;

/** Multi-city: each flight gets its own airports and date, in order. Each one is searched and booked separately. */
export function MultiCityEditor({ legs: initial, today, locale, homeCode, onConfirm }: { legs: TripLeg[]; today: string; locale: "en" | "fr"; homeCode?: string; onConfirm: (legs: TripLeg[]) => void }) {
  const fr = locale === "fr";
  const [legs, setLegs] = useState<TripLeg[]>(initial.length >= 2 ? initial : [...initial, ...Array.from({ length: 2 - initial.length }, () => ({}))]);
  const [editing, setEditing] = useState<Editing>(() => {
    const i = legs.findIndex((l) => !l.from || !l.to || !l.date);
    return i < 0 ? null : { leg: i, field: !legs[i].from ? "from" : !legs[i].to ? "to" : "date" };
  });

  const update = (i: number, patch: TripLeg) => {
    const next = legs.map((l, k) => (k === i ? { ...l, ...patch } : l));
    // The next flight leaves from where this one lands, unless the user said otherwise.
    if (patch.to && next[i + 1] && !next[i + 1].from) next[i + 1] = { ...next[i + 1], from: patch.to };
    setLegs(next);
    const l = next[i];
    setEditing(!l.from ? { leg: i, field: "from" } : !l.to ? { leg: i, field: "to" } : !l.date ? { leg: i, field: "date" } : null);
  };

  const minDate = (i: number) => legs.slice(0, i).reduce((m, l) => (l.date && l.date > m ? l.date : m), today);
  const problem = legs.some((l) => l.from && l.from === l.to) ? (fr ? "Un vol part et arrive au même aéroport." : "A flight leaves from and lands at the same airport.") : null;
  const complete = legs.every((l) => l.from && l.to && l.date) && !problem;
  const name = (code?: string) => (code ? `${findAirport(code)?.city ?? code} ${code}` : fr ? "Choisir" : "Choose");

  return (
    <div className="multi">
      <ol className="multi__legs">
        {legs.map((l, i) => (
          <li key={i} className="multi__leg">
            <span className="multi__num">{i + 1}</span>
            <div className="multi__fields">
              <button type="button" className={cx("multi__field", !l.from && "is-empty", editing?.leg === i && editing.field === "from" && "is-on")} onClick={() => setEditing({ leg: i, field: "from" })}>
                <small>{fr ? "De" : "From"}</small>
                <b>{name(l.from)}</b>
              </button>
              <ArrowRight className="multi__arrow" aria-hidden="true" />
              <button type="button" className={cx("multi__field", !l.to && "is-empty", editing?.leg === i && editing.field === "to" && "is-on")} onClick={() => setEditing({ leg: i, field: "to" })}>
                <small>{fr ? "À" : "To"}</small>
                <b>{name(l.to)}</b>
              </button>
              <button type="button" className={cx("multi__field multi__field--date", !l.date && "is-empty", editing?.leg === i && editing.field === "date" && "is-on")} onClick={() => setEditing({ leg: i, field: "date" })}>
                <CalendarDays />
                <b>{l.date ? shortDate(l.date, locale) : fr ? "Date" : "Date"}</b>
              </button>
            </div>
            {legs.length > 2 && (
              <button type="button" className="icon-btn multi__remove" onClick={() => (setLegs(legs.filter((_, k) => k !== i)), setEditing(null))} aria-label={fr ? `Retirer le vol ${i + 1}` : `Remove flight ${i + 1}`}>
                <X />
              </button>
            )}
            {editing?.leg === i && (
              <div className="multi__editor">
                {editing.field === "date" ? (
                  <Calendar mode="single" start={l.date} min={minDate(i)} max={addDays(today, MAX_DAYS_AHEAD)} onChange={(d) => d && update(i, { date: d })} locale={locale} />
                ) : (
                  <AirportPicker
                    key={`${i}-${editing.field}`}
                    role={editing.field === "from" ? "origin" : "destination"}
                    locale={locale}
                    homeCode={i === 0 ? homeCode : undefined}
                    exclude={[editing.field === "from" ? l.to : l.from].filter((x): x is string => Boolean(x))}
                    onPick={(code) => update(i, { [editing.field]: code })}
                    autoFocus
                    compact
                  />
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="multi__foot">
        {legs.length < MAX_LEGS && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => (setLegs([...legs, { from: legs.at(-1)?.to }]), setEditing({ leg: legs.length, field: legs.at(-1)?.to ? "to" : "from" }))}>
            <Plus />
            {fr ? "Ajouter un vol" : "Add a flight"}
          </button>
        )}
        <span className="dates__summary">{problem ?? (fr ? "Chaque vol est réservé séparément." : "Each flight is booked separately.")}</span>
        <button type="button" className="btn btn--primary" disabled={!complete} onClick={() => onConfirm(legs)}>
          {fr ? "Continuer" : "Continue"}
          <ArrowRight />
        </button>
      </div>
    </div>
  );
}
