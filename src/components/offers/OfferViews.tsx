"use client";
import { ArrowDownRight, ArrowUpRight, Bell, BellOff, BellRing, Car, ExternalLink, Hotel, Maximize2, Minus, Pause, Plane, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { CarCard } from "@/components/results/CarResults";
import { BookingDialog } from "@/components/results/BookingDialog";
import { FlightCard } from "@/components/results/FlightResults";
import { HotelCard } from "@/components/results/HotelResults";
import { PriceChart } from "@/components/tracking/PriceChart";
import { TrackDialog } from "@/components/tracking/TrackDialog";
import { Dialog } from "@/components/ui/Dialog";
import { DemoBadge, SmartImage } from "@/components/ui/primitives";
import { Price } from "@/components/ui/Price";
import { useToast } from "@/components/ui/Toast";
import { cityName } from "@/lib/data/catalog";
import { useStore } from "@/lib/store/AppStore";
import type { AnyOffer, PriceTracker, SavedOffer } from "@/lib/types";
import { cx, formatRange, money, timeAgo } from "@/lib/utils";

export function describeOffer(o: AnyOffer, locale: "en" | "fr" = "en") {
  if (o.kind === "flight") {
    const f = o.offer;
    return {
      title: `${cityName(f.outbound.from, locale)} → ${cityName(f.outbound.to, locale)}`,
      sub: `${f.airline.name} · ${formatRange(f.outbound.depart.slice(0, 10), f.inbound?.depart.slice(0, 10), locale)} · ${f.outbound.stops ? `${f.outbound.stops} stop` : "Nonstop"}`,
      start: f.outbound.depart.slice(0, 10),
    };
  }
  if (o.kind === "hotel") {
    const h = o.offer;
    return { title: h.name, sub: `${h.neighborhood}, ${h.city} · ${formatRange(h.checkIn, h.checkOut, locale)} · ${h.nights} nights`, start: h.checkIn };
  }
  const c = o.offer;
  return { title: `${c.category} · ${c.supplier}`, sub: `${c.pickupLocation} · ${formatRange(c.pickUp, c.dropOff, locale)}`, start: c.pickUp };
}

export function OfferThumb({ o }: { o: AnyOffer }) {
  if (o.kind === "flight")
    return (
      <span className="srow__thumb" style={{ background: "var(--bg-2)" }}>
        <span className="airline-logo" style={{ ["--c" as string]: o.offer.airline.color }}>
          {o.offer.airline.code}
        </span>
      </span>
    );
  return <SmartImage src={o.offer.image} alt="" className="srow__thumb" />;
}

export const KIND_ICON = { flight: Plane, hotel: Hotel, car: Car };

export function StatusBadge({ t }: { t: PriceTracker }) {
  if (t.status === "paused") return <span className="badge">Paused</span>;
  if (t.status === "target-reached") return <span className="badge badge--success">At or below target</span>;
  if (t.status === "unavailable") return <span className="badge badge--error">Unavailable</span>;
  return <span className="badge badge--accent">Tracking</span>;
}

export function Delta({ from, to, currency, locale }: { from: number; to: number; currency: PriceTracker["currency"]; locale: string }) {
  const d = to - from;
  if (d === 0)
    return (
      <span className="delta num">
        <Minus />
        no change
      </span>
    );
  return (
    <span className={cx("delta num", d < 0 ? "delta--down" : "delta--up")} title="Change since you saved it (simulated)">
      {d < 0 ? <ArrowDownRight /> : <ArrowUpRight />}
      {money(Math.abs(d), currency, locale)}
    </span>
  );
}

/** Full offer card inside a dialog — used to "open" a saved offer. */
export function OfferDetailDialog({ item, onClose }: { item: SavedOffer | null; onClose: () => void }) {
  const { settings } = useStore();
  if (!item) return null;
  const o = item.data;
  return (
    <Dialog open onClose={onClose} title={describeOffer(o, settings.locale).title} description={`Saved ${timeAgo(item.savedAt, settings.locale)} · demo data`} wide>
      {o.kind === "flight" && <FlightCard offer={o.offer} tags={[]} locale={settings.locale} />}
      {o.kind === "hotel" && <HotelCard h={o.offer} locale={settings.locale} />}
      {o.kind === "car" && <CarCard c={o.offer} locale={settings.locale} />}
    </Dialog>
  );
}

/** Saved offer row with open / track / remove / outbound actions. */
export function SavedRow({ item, onOpen, index = 0 }: { item: SavedOffer; onOpen: (s: SavedOffer) => void; index?: number }) {
  const store = useStore();
  const toast = useToast();
  const [track, setTrack] = useState(false);
  const [book, setBook] = useState(false);
  const loc = store.settings.locale;
  const o = item.data;
  const bookable = o.kind === "flight" && o.offer.source === "live" && o.offer.booking ? o.offer : null;
  const d = describeOffer(o, loc);
  const tracker = store.trackerFor(item.id);
  const price = tracker?.lastKnownPrice ?? o.offer.totalPrice;
  const url = o.offer.bookingUrl ?? o.offer.searchUrl;

  const remove = () => {
    store.removeSaved(item.id);
    toast({
      tone: "info",
      title: "Removed from saved",
      description: tracker ? "Tracking for this offer stopped." : d.title,
      action: { label: "Undo", onClick: () => store.saveOffer(o, item.conversationId) },
    });
  };

  return (
    <div className="srow" data-glow style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <OfferThumb o={o} />
      <div className="srow__main">
        <div className="srow__title">
          <span>{d.title}</span>
        </div>
        <div className="srow__sub">{d.sub}</div>
        <div className="srow__badges">
          {tracker ? <StatusBadge t={tracker} /> : null}
          {tracker && (
            <span className="badge num" title="Your target price">
              Target {money(tracker.targetPrice, tracker.currency, loc)}
            </span>
          )}
          {o.offer.source === "demo" && <DemoBadge label="Demo" />}
        </div>
      </div>
      <div className="srow__price">
        <Price amount={price} currency={o.offer.currency} locale={loc} />
        {tracker ? <Delta from={tracker.savedPrice} to={tracker.lastKnownPrice} currency={tracker.currency} locale={loc} /> : <span className="t-meta">total</span>}
      </div>
      <div className="srow__actions">
        <button className="icon-btn" onClick={() => onOpen(item)} aria-label={`Open ${d.title}`} title="Open">
          <Maximize2 />
        </button>
        <button className={cx("icon-btn", tracker && "icon-btn--on")} onClick={() => setTrack(true)} aria-label={tracker ? "Edit tracking" : "Track price"} title={tracker ? "Edit tracking" : "Track price"}>
          {tracker ? <BellRing /> : <Bell />}
        </button>
        {bookable ? (
          <button className="icon-btn" onClick={() => setBook(true)} aria-label="Book this flight" title="Book: see who sells it">
            <ExternalLink />
          </button>
        ) : (
          <a
            className="icon-btn"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={o.offer.bookingUrl ? "Continue to the provider (opens in a new tab)" : "Search these dates and places (opens in a new tab; not this exact offer)"}
            title={o.offer.bookingUrl ? "Continue to the provider" : "Search these dates and places — not this exact offer"}
          >
            <ExternalLink />
          </a>
        )}
        {bookable && <BookingDialog offer={bookable} open={book} onClose={() => setBook(false)} />}
        <button className="icon-btn" onClick={remove} aria-label={`Remove ${d.title}`} title="Remove">
          <Trash2 />
        </button>
      </div>
      <TrackDialog
        open={track}
        onClose={() => setTrack(false)}
        offer={o}
        title={d.title}
        subtitle={d.sub}
        currentPrice={price}
        currency={o.offer.currency}
        initialTarget={tracker?.targetPrice}
        isEditing={Boolean(tracker)}
        locale={loc}
        onStop={
          tracker
            ? () => {
                store.stopTracking(tracker.id);
                setTrack(false);
                toast({ tone: "info", title: "Tracking stopped", description: "The offer stays in your saved list." });
              }
            : undefined
        }
        onConfirm={(target) => {
          const r = store.startTracking(o, target, item.conversationId);
          setTrack(false);
          if (!r.ok) toast({ tone: "info", title: "Plan limit reached", description: r.message });
          else toast({ title: tracker ? "Target updated" : "Tracking started (simulated)" });
        }}
      />
    </div>
  );
}

/** Compact tracker row for the dashboard. */
export function TrackerRow({ t }: { t: PriceTracker }) {
  const { settings } = useStore();
  const Icon = KIND_ICON[t.kind];
  return (
    <div className="trow" data-glow>
      <div style={{ minWidth: 0 }}>
        <div className="trow__title">
          <Icon />
          <span>{t.label}</span>
        </div>
        <div className="trow__sub">
          {t.subLabel} · checked {timeAgo(t.lastCheckedAt, settings.locale)}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          <StatusBadge t={t} />
          <span className="badge num">Target {money(t.targetPrice, t.currency, settings.locale)}</span>
        </div>
      </div>
      <div className="spark">
        <PriceChart history={t.history.slice(-20)} target={t.targetPrice} currency={t.currency} height={40} compact />
      </div>
      <div className="trow__prices">
        <Price amount={t.lastKnownPrice} currency={t.currency} locale={settings.locale} size="sm" />
        <Delta from={t.savedPrice} to={t.lastKnownPrice} currency={t.currency} locale={settings.locale} />
      </div>
    </div>
  );
}

/** Full tracker with chart and controls (Price tracking page). */
export function TrackerCard({ t, index = 0 }: { t: PriceTracker; index?: number }) {
  const store = useStore();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const loc = store.settings.locale;
  const Icon = KIND_ICON[t.kind];
  const saved = store.saved.find((s) => s.id === t.offerId);

  return (
    <article className="tcard" data-glow style={{ animationDelay: `${index * 50}ms` }}>
      <div className="tcard__info">
        <div>
          <div className="t-eyebrow" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon style={{ width: 13, height: 13 }} />
            {t.kind === "flight" ? "Flight" : t.kind === "hotel" ? "Stay" : "Rental car"}
          </div>
          <h3 className="tcard__title" style={{ marginTop: 4 }}>
            {t.label}
          </h3>
          <div className="t-meta">{t.subLabel}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <StatusBadge t={t} />
          {t.source === "demo" ? <DemoBadge label="Simulated prices" /> : <span className="badge badge--live">Live fare</span>}
        </div>
        <div className="tcard__stats">
          <div className="stat">
            <div className="stat__label">Saved at</div>
            <div className="stat__value num">{money(t.savedPrice, t.currency, loc)}</div>
          </div>
          <div className="stat">
            <div className="stat__label">{t.source === "demo" ? "Now (simulated)" : "Last known"}</div>
            <div className="stat__value num">{money(t.lastKnownPrice, t.currency, loc)}</div>
          </div>
          <div className="stat stat--target">
            <div className="stat__label">Your target</div>
            <div className="stat__value num">{money(t.targetPrice, t.currency, loc)}</div>
          </div>
        </div>
        <div className="t-meta">
          {t.source === "demo"
            ? `Last simulated check ${timeAgo(t.lastCheckedAt, loc)} · ${t.history.length} data points`
            : `Price from ${timeAgo(t.lastCheckedAt, loc)}. Automatic re-checks for live fares aren't running yet; search again to see the current fare.`}
        </div>
        <div className="tcard__actions">
          <button className="btn btn--secondary btn--sm" onClick={() => setEdit(true)}>
            Edit target
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              store.updateTracker(t.id, { status: t.status === "paused" ? "active" : "paused" });
              toast({ tone: "info", title: t.status === "paused" ? "Tracking resumed" : "Tracking paused" });
            }}
          >
            {t.status === "paused" ? <Play /> : <Pause />}
            {t.status === "paused" ? "Resume" : "Pause"}
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              store.runSimulatedCheck(t.id);
              toast({ tone: "info", title: "Simulated check complete", description: "A demo price point was added. This is not a live fare." });
            }}
            disabled={t.status === "paused"}
          >
            Run simulated check
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              store.stopTracking(t.id);
              toast({ tone: "info", title: "Tracking stopped", description: saved ? "The offer stays in your saved list." : undefined });
            }}
          >
            <BellOff />
            Stop
          </button>
        </div>
      </div>
      <div className="tcard__chart">
        <PriceChart history={t.history} target={t.targetPrice} currency={t.currency} locale={loc} height={210} />
      </div>
      <TrackDialog
        open={edit}
        onClose={() => setEdit(false)}
        title={t.label}
        subtitle={t.subLabel}
        currentPrice={t.lastKnownPrice}
        currency={t.currency}
        initialTarget={t.targetPrice}
        isEditing
        locale={loc}
        onConfirm={(target) => {
          store.updateTracker(t.id, { targetPrice: target });
          setEdit(false);
          toast({ title: "Target updated" });
        }}
      />
    </article>
  );
}
