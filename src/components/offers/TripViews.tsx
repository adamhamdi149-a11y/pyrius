"use client";
import { Car, Check, ChevronRight, Hotel, MessageSquare, Plane, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { SmartImage } from "@/components/ui/primitives";
import { findAirport, placeName } from "@/lib/data/world";
import { useStore } from "@/lib/store/AppStore";
import type { Conversation, SavedOffer } from "@/lib/types";
import { cx, formatRange, parseDate, timeAgo, toISODate } from "@/lib/utils";

export interface TripSummary {
  conv: Conversation;
  title: string;
  dest?: string;
  dates?: string;
  image?: string;
  travelers: number;
  upcoming: boolean;
  has: { flight: boolean; hotel: boolean; car: boolean };
}

export function summarizeTrips(conversations: Conversation[], saved: SavedOffer[], locale: "en" | "fr"): TripSummary[] {
  const today = toISODate(new Date());
  return conversations
    .filter((c) => c.messages.length > 0)
    .map((c) => {
      const p = c.prefs;
      const mine = saved.filter((s) => s.conversationId === c.id);
      return {
        conv: c,
        title: p.originCode && p.destinationCode ? `${placeName(p.originCode, locale)} → ${placeName(p.destinationCode, locale)}` : c.title,
        dest: p.destinationCode ? placeName(p.destinationCode, locale) : undefined,
        dates: p.departDate ? formatRange(p.departDate, p.returnDate, locale) : undefined,
        image: findAirport(p.destinationCode)?.image,
        travelers: (p.adults ?? 0) + (p.children ?? 0),
        upcoming: Boolean(p.departDate && p.departDate >= today && p.destinationCode),
        has: { flight: mine.some((s) => s.kind === "flight"), hotel: mine.some((s) => s.kind === "hotel"), car: mine.some((s) => s.kind === "car") },
      };
    });
}

function useReopen() {
  const store = useStore();
  const router = useRouter();
  return (id: string) => {
    store.setActiveId(id);
    router.push("/app");
  };
}

export function TripRow({ trip }: { trip: TripSummary }) {
  const reopen = useReopen();
  const { settings } = useStore();
  return (
    <button className="trip" onClick={() => reopen(trip.conv.id)}>
      {trip.image ? (
        <SmartImage src={trip.image.replace("w=1200", "w=200")} alt="" className="trip__thumb" />
      ) : (
        <span className="trip__thumb" style={{ display: "grid", placeItems: "center", background: "var(--surface-2)", color: "var(--text-3)" }}>
          <MessageSquare style={{ width: 18, height: 18 }} />
        </span>
      )}
      <span className="trip__text">
        <span className="trip__title" style={{ display: "block" }}>
          {trip.title}
        </span>
        <span className="trip__meta">{trip.dates ?? `Updated ${timeAgo(trip.conv.updatedAt, settings.locale)}`}</span>
      </span>
      <ChevronRight />
    </button>
  );
}

/** Dashboard focal point: the next (or most recent) trip with its planning progress. */
export function TripSpotlight({ trip, saved, trackedCount }: { trip: TripSummary; saved: SavedOffer[]; trackedCount: number }) {
  const reopen = useReopen();
  const { settings } = useStore();
  const p = trip.conv.prefs;
  const days = p.departDate ? Math.round((parseDate(p.departDate).getTime() - Date.now()) / 86400000) : null;
  const mine = saved.filter((s) => s.conversationId === trip.conv.id);
  const done = [trip.has.flight, trip.has.hotel, trip.has.car].filter(Boolean).length;
  const steps = [
    { k: "flight", label: "Flight", icon: Plane },
    { k: "hotel", label: "Stay", icon: Hotel },
    { k: "car", label: "Car", icon: Car },
  ] as const;
  return (
    <section className="spot" aria-label="Next trip">
      {trip.image && <SmartImage src={trip.image.replace("w=1200", "w=1400")} alt="" className="spot__img" />}
      <div className="spot__shade" aria-hidden="true" />
      <div className="spot__content">
        <div className="spot__eyebrow">
          {trip.upcoming && days !== null ? (days <= 0 ? "Departing today" : `Next trip · in ${days} day${days === 1 ? "" : "s"}`) : "Most recent plan"}
        </div>
        <h2 className="spot__title">{trip.dest ?? trip.title}</h2>
        <p className="spot__sub">
          {p.originCode ? `From ${placeName(p.originCode, settings.locale)} · ` : ""}
          {trip.dates ?? "Dates not set"}
          {trip.travelers > 0 && ` · ${trip.travelers} traveler${trip.travelers > 1 ? "s" : ""}`}
        </p>
        <div className="spot__progress">
          <div className="spot__bar" aria-hidden="true">
            <i style={{ width: `${(done / 3) * 100}%` }} />
          </div>
          <div className="spot__steps">
            {steps.map(({ k, label, icon: Icon }) => (
              <span key={k} className={cx("spot__step", trip.has[k] && "spot__step--done")}>
                {trip.has[k] ? <Check /> : <Icon />}
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="spot__actions">
          <button className="btn btn--primary" onClick={() => reopen(trip.conv.id)}>
            <MessageSquare />
            {done === 3 ? "Review plan" : "Continue planning"}
          </button>
          <span className="spot__meta">
            {mine.length} saved · {trackedCount} tracked
          </span>
        </div>
      </div>
    </section>
  );
}

export function TripCard({ trip, index, onDelete }: { trip: TripSummary; index: number; onDelete: () => void }) {
  const reopen = useReopen();
  const { settings } = useStore();
  const steps = [
    { k: "flight", label: "Flight", icon: Plane },
    { k: "hotel", label: "Stay", icon: Hotel },
    { k: "car", label: "Car", icon: Car },
  ] as const;
  return (
    <article className="tripcard" data-glow style={{ animationDelay: `${index * 50}ms` }}>
      <div className="tripcard__media">
        {trip.image ? (
          <SmartImage src={trip.image.replace("w=1200", "w=700")} alt={trip.dest ?? ""} ratio="16 / 9" />
        ) : (
          <div style={{ aspectRatio: "16 / 9", background: "radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--accent) 25%, transparent), transparent 60%), var(--surface-2)" }} />
        )}
        <div className="tripcard__place">
          <b>{trip.dest ?? trip.title}</b>
          <span>{trip.dates ?? "Dates not set yet"}</span>
        </div>
      </div>
      <div className="tripcard__body">
        <div className="t-meta">
          {trip.title}
          {trip.travelers > 0 && ` · ${trip.travelers} traveler${trip.travelers > 1 ? "s" : ""}`} · updated {timeAgo(trip.conv.updatedAt, settings.locale)}
        </div>
        <div className="steps" aria-label="Saved for this trip">
          {steps.map(({ k, label, icon: Icon }) => (
            <span key={k} className={cx("step", trip.has[k] && "step--done")}>
              {trip.has[k] ? <Check /> : <Icon />}
              {label}
            </span>
          ))}
        </div>
        <div className="tripcard__actions">
          <button className="btn btn--secondary btn--sm" onClick={() => reopen(trip.conv.id)}>
            <MessageSquare />
            Continue planning
          </button>
          <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onDelete} aria-label={`Delete ${trip.title}`} title="Delete conversation">
            <Trash2 />
          </button>
        </div>
      </div>
    </article>
  );
}
