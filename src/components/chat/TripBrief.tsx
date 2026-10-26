"use client";
import { ArrowLeftRight, ArrowRight, Car, Check, Hotel, ListChecks, Plane, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { cabinText, travelersText, type EditTarget } from "@/components/flow/FlowPanel";
import { placeName } from "@/lib/data/world";
import { tripKind } from "@/lib/flights/workflow";
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
 * Live, editable summary of the trip. Every part is a fact the trip actually holds; tapping one opens
 * its airport picker, calendar or travelers control. Missing parts are shown as placeholders and
 * defaults are marked as such.
 */
export function TripBrief({
  conv,
  saved,
  locale,
  pending,
  aside,
  onEdit,
  onSwap,
}: {
  conv: Conversation;
  saved: Set<OfferKind>;
  locale: "en" | "fr";
  pending: boolean;
  aside?: ReactNode;
  onEdit?: (t: EditTarget) => void;
  onSwap?: () => void;
}) {
  const p = conv.prefs;
  const L = (en: string, fr: string) => (locale === "fr" ? fr : en);
  const current = STAGE_INDEX[conv.stage];
  const steps = [
    { label: L("Details", "Détails"), icon: ListChecks, done: current > 0 },
    { label: L("Flights", "Vols"), icon: Plane, done: saved.has("flight") || current > 1 },
    { label: L("Stay", "Séjour"), icon: Hotel, done: saved.has("hotel") || current > 2 },
    { label: L("Car", "Voiture"), icon: Car, done: saved.has("car") || current > 3 },
  ];
  const progress = Math.min(1, current / 4);
  const kind = tripKind(p);
  const edit = (t: EditTarget) => (onEdit && !pending ? () => onEdit(t) : undefined);
  const defaults = !p.confirmed?.travelers && !p.adults;
  const extras: string[] = [];
  if (p.budget) extras.push(`≤ ${money(p.budget, p.currency, locale)}`);
  if (p.nonstopOnly) extras.push(L("Nonstop", "Direct"));

  const fact = (target: EditTarget, set: boolean, label: string, children: ReactNode) => (
    <button key={target} type="button" className={cx("brief__fact brief__fact--edit", !set && "is-empty")} onClick={edit(target)} disabled={!onEdit || pending} aria-label={label}>
      {!set && <Plus />}
      {children}
    </button>
  );

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
        <div className="brief__facts" role="group" aria-label={L("Your trip — tap to change", "Votre voyage — touchez pour modifier")}>
          {kind === "multi" ? (
            fact("dates", Boolean(p.legs?.every((l) => l.from && l.to && l.date)), L("Edit the route", "Modifier l'itinéraire"), <>{[p.legs?.[0]?.from ?? "?", ...(p.legs ?? []).map((l) => l.to ?? "?")].join(" → ")}</>)
          ) : (
            <span className="brief__route">
              {fact("origin", Boolean(p.originCode), L("Change the departure airport", "Changer l'aéroport de départ"), <>
                {p.originCode ? placeName(p.originCode, locale) : L("From", "Départ")}
              </>)}
              {p.originCode && p.destinationCode && onSwap ? (
                <button type="button" className="brief__swap" onClick={onSwap} disabled={pending} aria-label={L("Swap departure and destination", "Inverser départ et destination")}>
                  <ArrowLeftRight />
                </button>
              ) : (
                <ArrowRight className="brief__arrow" aria-hidden="true" />
              )}
              {fact("destination", Boolean(p.destinationCode), L("Change the destination", "Changer la destination"), <>
                {p.destinationCode ? placeName(p.destinationCode, locale) : L("To", "Destination")}
              </>)}
            </span>
          )}
          {kind !== "multi" &&
            fact(
              "dates",
              Boolean(p.departDate),
              L("Change the dates", "Changer les dates"),
              <>
                {p.departDate
                  ? formatRange(p.departDate, kind === "round" ? p.returnDate : undefined, locale) +
                    (kind === "oneway" ? L(" · one way", " · aller simple") : kind === "round" && !p.returnDate ? L(" · return?", " · retour ?") : "")
                  : L("Dates", "Dates")}
              </>,
            )}
          {fact("travelers", true, L("Change travelers and cabin", "Changer les voyageurs et la classe"), <>
            <span className={cx(defaults && "brief__default")}>
              {travelersText(p, locale)} · {cabinText(p, locale)}
            </span>
          </>)}
          {extras.map((x) => (
            <span key={x} className="brief__fact">
              {x}
            </span>
          ))}
        </div>
        {aside && <div className="brief__aside">{aside}</div>}
      </div>
    </div>
  );
}
