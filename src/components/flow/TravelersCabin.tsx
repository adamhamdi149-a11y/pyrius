"use client";
import { Armchair, Crown, Minus, Plus, Sofa, Star } from "lucide-react";
import { CABIN_LABEL, CABIN_LABEL_FR, CABINS, MAX_PASSENGERS, travelerBounds, type Travelers } from "@/lib/flights/workflow";
import type { Cabin } from "@/lib/types";
import { cx } from "@/lib/utils";

/** Plus/minus steppers that only allow combinations the airlines and Google Flights accept. */
export function TravelersPicker({ value, onChange, locale }: { value: Travelers; onChange: (v: Travelers) => void; locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const b = travelerBounds(value);
  const rows: { key: keyof Travelers; label: string; hint: string }[] = [
    { key: "adults", label: fr ? "Adultes" : "Adults", hint: fr ? "12 ans et plus" : "12+" },
    { key: "children", label: fr ? "Enfants" : "Children", hint: fr ? "2 à 11 ans" : "Ages 2–11" },
    { key: "infants", label: fr ? "Bébés" : "Infants", hint: fr ? "Moins de 2 ans, sur les genoux" : "Under 2, on a lap" },
  ];
  return (
    <div className="pax" role="group" aria-label={fr ? "Voyageurs" : "Travelers"}>
      {rows.map(({ key, label, hint }) => (
        <div key={key} className="pax__row">
          <span className="pax__label">
            <b>{label}</b>
            <small>{hint}</small>
          </span>
          <span className="pax__stepper">
            <button type="button" className="pax__btn" onClick={() => onChange({ ...value, [key]: value[key] - 1 })} disabled={!b[key].remove} aria-label={`${fr ? "Retirer" : "Remove"} ${label.toLowerCase()}`}>
              <Minus />
            </button>
            <output className="pax__count num" aria-live="polite">
              {value[key]}
            </output>
            <button type="button" className="pax__btn" onClick={() => onChange({ ...value, [key]: value[key] + 1 })} disabled={!b[key].add} aria-label={`${fr ? "Ajouter" : "Add"} ${label.toLowerCase()}`}>
              <Plus />
            </button>
          </span>
        </div>
      ))}
      <p className="pax__note">
        {fr
          ? `Jusqu'à ${MAX_PASSENGERS} voyageurs, un adulte par bébé.`
          : `Up to ${MAX_PASSENGERS} travelers, with one adult for each lap infant.`}
      </p>
    </div>
  );
}

const CABIN_ICON: Record<Cabin, typeof Armchair> = { economy: Armchair, premium_economy: Sofa, business: Star, first: Crown };

/** Every class Google Flights can search; each search returns only what airlines sell on the route. */
export function CabinPicker({ value, onChange, locale }: { value: Cabin; onChange: (c: Cabin) => void; locale: "en" | "fr" }) {
  const labels = locale === "fr" ? CABIN_LABEL_FR : CABIN_LABEL;
  return (
    <div className="cabins" role="radiogroup" aria-label={locale === "fr" ? "Classe" : "Cabin class"}>
      {CABINS.map((c) => {
        const Icon = CABIN_ICON[c];
        return (
          <button key={c} type="button" role="radio" aria-checked={value === c} className={cx("cabin", value === c && "is-on")} onClick={() => onChange(c)}>
            <Icon />
            <span>{labels[c]}</span>
          </button>
        );
      })}
    </div>
  );
}
