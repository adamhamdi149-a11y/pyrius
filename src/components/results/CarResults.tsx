"use client";
import { Anchor, Building2, Car, Clock, ExternalLink, Globe, MapPin, Navigation, Phone, Plane, RotateCcw, Star } from "lucide-react";
import { DemoBadge, Skeleton, SmartImage } from "@/components/ui/primitives";
import { findAirport } from "@/lib/data/world";
import { useStore } from "@/lib/store/AppStore";
import type { Attachment, BusinessCategory, LocalBusiness, LocalBusinessResult } from "@/lib/types";
import { useSearch } from "@/lib/useSearch";
import { stagger } from "@/lib/motion";
import { SourceLine } from "./SearchProgress";

type CarAttachment = Extract<Attachment, { type: "cars" }>;
type BizAttachment = Extract<Attachment, { type: "businesses" }>;

const COPY: Record<BusinessCategory, { title: string; noun: string; icon: typeof Car; fine: string }> = {
  "Car rental agency": {
    title: "Car rental agencies",
    noun: "agencies",
    icon: Car,
    fine: "Real agencies listed on Google Maps, with their Google rating. Rental prices aren't published in a form Pyrius can read: each agency quotes on its website or by phone, so compare two or three before you book.",
  },
  "Car dealership": {
    title: "Car dealerships",
    noun: "dealerships",
    icon: Building2,
    fine: "Real dealerships listed on Google Maps, with their Google rating. Dealers publish their stock and prices on their own websites. For a short trip, a rental agency is usually what you need.",
  },
  "Private jet charter": {
    title: "Private jet charters",
    noun: "operators",
    icon: Plane,
    fine: "Real charter operators and brokers listed on Google Maps near this airport. Charter prices depend on the aircraft, route and dates and are quoted by each operator. Ask Pyrius for published empty-leg deals: it searches the web and links each source.",
  },
  "Yacht charter": {
    title: "Yacht charters",
    noun: "charters",
    icon: Anchor,
    fine: "Real yacht and boat charter companies listed on Google Maps. Prices depend on the boat, season and crew and are quoted by each company. Ask Pyrius for published charter deals: it searches the web and links each source.",
  },
};

/** A real business from Google Maps. Pyrius has no partnership with any listed business. */
export function LocalBusinessCard({ b, index = 0, locale }: { b: LocalBusiness; index?: number; locale: string }) {
  const Icon = COPY[b.category].icon;
  return (
    <article className="bcard" data-glow style={stagger(index)}>
      {b.image ? <SmartImage src={b.image} alt="" className="bcard__img" ratio="1 / 1" /> : <div className="bcard__icon"><Icon /></div>}
      <div className="bcard__body">
        <div className="t-eyebrow">{b.type ?? b.category}</div>
        <h3 className="t-h3 bcard__name">{b.name}</h3>
        <div className="bcard__facts">
          {b.rating !== undefined && (
            <span className="bcard__rating num" title={`Google rating${b.reviews ? ` from ${b.reviews.toLocaleString(locale)} reviews` : ""}`}>
              <Star />
              {b.rating.toFixed(1)}
              {b.reviews !== undefined && <small>({b.reviews.toLocaleString(locale)})</small>}
            </span>
          )}
          {b.distanceKm !== undefined && <span className="num">{b.distanceKm} km away</span>}
          {b.hours && (
            <span>
              <Clock />
              {b.hours}
            </span>
          )}
        </div>
        {b.address && (
          <div className="t-meta bcard__addr">
            <MapPin />
            <span>{b.address}</span>
          </div>
        )}
      </div>
      <div className="bcard__actions">
        {b.phone && (
          <a className="btn btn--secondary btn--sm" href={`tel:${b.phone.replace(/[^\d+]/g, "")}`} title={b.phone}>
            <Phone />
            Call
          </a>
        )}
        {b.website && (
          <a className="btn btn--primary btn--sm" href={b.website} target="_blank" rel="noopener noreferrer">
            <Globe />
            Website
          </a>
        )}
        {b.mapUrl && (
          <a className="btn btn--ghost btn--sm" href={b.mapUrl} target="_blank" rel="noopener noreferrer">
            <Navigation />
            Map
          </a>
        )}
      </div>
    </article>
  );
}

export function BusinessDirectory({ attachment }: { attachment: Pick<BizAttachment, "destinationCode" | "category" | "snapshot"> }) {
  const { settings } = useStore();
  const res = useSearch<LocalBusinessResult>("businesses", { destinationCode: attachment.destinationCode, category: attachment.category }, !attachment.snapshot);
  const data = attachment.snapshot ?? (res.status === "ok" ? res.data : null);
  const copy = COPY[attachment.category] ?? COPY["Car rental agency"];
  const city = findAirport(attachment.destinationCode)?.city ?? attachment.destinationCode;
  const live = data?.source === "live";

  return (
    <section className="results" aria-label={copy.title}>
      <div className="summary">
        <div className="summary__route">
          <span className="t-eyebrow">Local companies</span>
          <div className="summary__places">
            <span>{copy.title}</span>
          </div>
        </div>
        <div className="summary__meta">
          <span>
            <MapPin />
            Near {city}
          </span>
          {live && <span className="badge badge--live">Live · Google Maps</span>}
          {data && !live && <DemoBadge label="No data source" />}
        </div>
      </div>
      {!data && res.status === "loading" && <Skeleton h={180} r={16} />}
      {!data && res.status === "error" && (
        <div className="results__error">
          <span>{res.error}</span>
          <button className="btn btn--secondary btn--sm" onClick={res.retry}>
            <RotateCcw />
            Try again
          </button>
        </div>
      )}
      {data &&
        (data.businesses.length ? (
          <>
            <SourceLine count={data.businesses.length} noun={copy.noun} live={live} provider={data.provider} fetchedAt={data.fetchedAt} note="Real businesses · prices are quoted by each company" />
            {data.widened && (
              <p className="notice notice--soft">
                Google Maps lists no {copy.title.toLowerCase()} close to {city}. These are the nearest ones, with how far away they are.
              </p>
            )}
            <div className="results__list">
              {data.businesses.map((b, i) => (
                <LocalBusinessCard key={b.id} b={b} index={i} locale={settings.locale} />
              ))}
            </div>
          </>
        ) : (
          <div className="directory-empty">
            <div className="directory-empty__art" aria-hidden="true">
              <MapPin />
            </div>
            <div className="directory-empty__text">
              <h3 className="t-h3">No {copy.title.toLowerCase()} found near {city}</h3>
              <p className="t-body" style={{ fontSize: "var(--fs-sm)", marginTop: 4 }}>
                Google Maps returned none for this area. You can widen the search on Google Maps yourself, or ask Pyrius to look near another city.
              </p>
            </div>
            <a className="btn btn--primary" href={data.mapSearchUrl} target="_blank" rel="noopener noreferrer">
              Search on Google Maps
              <ExternalLink />
            </a>
          </div>
        ))}
      <p className="results__fine">{copy.fine} Businesses shown here are never partners or sponsors of Pyrius.</p>
    </section>
  );
}

/** Older conversations asked for rental-car estimates; they now show the real rental agencies at that airport. */
export function CarResults({ attachment }: { attachment: CarAttachment; conversationId?: string; onSaved?: (k: "flight" | "hotel" | "car") => void }) {
  return <BusinessDirectory attachment={{ destinationCode: attachment.params.destinationCode, category: "Car rental agency" }} />;
}
