"use client";
import { Car, Check, Hotel, ListChecks, Plane } from "lucide-react";
import type { ReactNode } from "react";
import { cityName } from "@/lib/data/catalog";
import type { Conversation, OfferKind } from "@/lib/types";
import { cx, formatRange, money } from "@/lib/utils";

const STAGE_INDEX: Record<Conversation["stage"], number> = {
  collecting: 0,
  flights: 1,
  "offer-hotels": 2,
  hotels: 2,
  "offer-cars": 3,
  cars: 3,
  done: 4,
};

/**
 * Live summary of the trip as the conversation fills it in. Every chip is a fact
 * the assistant actually captured; steps advance with the real conversation stage.
 */
export function TripBrief({ conv, saved, locale, pending, aside }: { conv: Conversation; saved: Set<OfferKind>; locale: "en" | "fr"; pending: boolean; aside?: ReactNode }) {
  const p = conv.prefs;
  const L = (en: string, fr: string) => (locale === "fr" ? fr : en);
  const current = STAGE_INDEX[conv.stage];
  const steps = [
    { label: L("Details", "Détails"), icon: ListChecks, done: current > 0 },
    { label: L("Flights", "Vols"), icon: Plane, done: saved.has("flight") || current > 1 },
    { label: L("Stay", "Séjour"), icon: Hotel, done: saved.has("hotel") || current > 2 },
    { label: L("Car", "Voiture"), icon: Car, done: saved.has("car") || current > 3 },
  ];
  const travelers = (p.adults ?? 0) + (p.children ?? 0);
  const facts: { k: string; v: string }[] = [];
  if (p.originCode) facts.push({ k: "from", v: cityName(p.originCode, locale) });
  if (p.destinationCode) facts.push({ k: "to", v: `→ ${cityName(p.destinationCode, locale)}` });
  else if (p.wantsWarm) facts.push({ k: "to", v: L("→ somewhere warm", "→ au chaud") });
  if (p.departDate) facts.push({ k: "dates", v: formatRange(p.departDate, p.returnDate, locale) + (p.flexibleDates ? " ±" : "") });
  if (travelers) facts.push({ k: "pax", v: L(`${travelers} traveler${travelers > 1 ? "s" : ""}`, `${travelers} voyageur${travelers > 1 ? "s" : ""}`) });
  if (p.budget) facts.push({ k: "budget", v: `≤ ${money(p.budget, p.currency, locale)}` });
  if (p.nonstopOnly) facts.push({ k: "nonstop", v: L("Nonstop", "Direct") });

  const progress = Math.min(1, current / 4);

  return (
    <div className="brief" data-pending={pending}>
      <div className="brief__inner">
        <ol className="brief__steps" aria-label={L("Trip planning progress", "Progression du voyage")}>
          <span className="brief__track" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </span>
          {steps.map(({ label, icon: Icon, done }, i) => {
            const active = i === current;
            return (
              <li key={label} className={cx("brief__step", done && "is-done", active && "is-active")} aria-current={active ? "step" : undefined}>
                <span className="brief__dot">{done ? <Check /> : <Icon />}</span>
                <span className="brief__label">{label}</span>
              </li>
            );
          })}
        </ol>
        {facts.length > 0 && (
          <ul className="brief__facts" aria-label={L("What Pyrius knows so far", "Ce que Pyrius sait déjà")}>
            {facts.map((f) => (
              <li key={`${f.k}:${f.v}`} className="brief__fact">
                {f.v}
              </li>
            ))}
          </ul>
        )}
        {aside && <div className="brief__aside">{aside}</div>}
      </div>
    </div>
  );
}
