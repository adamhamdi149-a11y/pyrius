"use client";
import { Briefcase, Building2, Car, CheckCircle2, ExternalLink, Globe, MapPin, Navigation, Phone, RotateCcw, Settings2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { DemoBadge, EmptyState, Skeleton, SmartImage } from "@/components/ui/primitives";
import { airportByCode } from "@/lib/data/catalog";
import { useStore } from "@/lib/store/AppStore";
import type { Attachment, CarOffer, LocalBusiness, LocalBusinessResult } from "@/lib/types";
import { useSearch } from "@/lib/useSearch";
import { formatRange, money } from "@/lib/utils";
import { SearchSummary } from "./FlightResults";
import { OfferActions } from "./OfferActions";

type CarAttachment = Extract<Attachment, { type: "cars" }>;
type BizAttachment = Extract<Attachment, { type: "businesses" }>;

export function CarCard({ c, conversationId, onSaved, locale }: { c: CarOffer; conversationId?: string; onSaved?: (k: "flight" | "hotel" | "car") => void; locale: string }) {
  return (
    <article className="ccard">
      <SmartImage src={c.image} alt={`${c.category} car — representative photo`} className="ccard__img" ratio="16 / 10" sizes="(max-width: 900px) 100vw, 440px" />
      <div className="ccard__body">
        <div className="ccard__head">
          <div>
            <div className="t-eyebrow">{c.category}</div>
            <h3 className="ccard__name">{c.example}</h3>
          </div>
          <span className="ccard__supplier">{c.supplier}</span>
        </div>
        <div className="ccard__specs">
          <span>
            <Users />
            {c.seats}
          </span>
          <span>
            <Briefcase />
            {c.bags}
          </span>
          <span>
            <Settings2 />
            {c.transmission}
          </span>
        </div>
        <div className="ccard__where">
          <MapPin />
          <span>
            {c.pickupLocation}
            <span className="t-meta"> · {formatRange(c.pickUp, c.dropOff, locale)}</span>
          </span>
        </div>
        <ul className="ccard__conds">
          {c.conditions.slice(0, 2).map((x) => (
            <li key={x}>
              <CheckCircle2 />
              {x}
            </li>
          ))}
        </ul>
        <div className="ccard__price">
          <span className="price price--sm num">{money(c.totalPrice, c.currency, locale)}</span>
          <span className="t-meta num">
            est. total · {c.days} day{c.days > 1 ? "s" : ""}
          </span>
        </div>
        <OfferActions offer={{ kind: "car", offer: c }} conversationId={conversationId} onSaved={onSaved} compact />
      </div>
    </article>
  );
}

export function CarResults({ attachment, conversationId, onSaved }: { attachment: CarAttachment; conversationId?: string; onSaved?: (k: "flight" | "hotel" | "car") => void }) {
  const { settings } = useStore();
  const locale = settings.locale;
  const res = useSearch<{ offers: CarOffer[] }>("cars", attachment.params);
  const [cat, setCat] = useState("all");
  const offers = res.status === "ok" ? res.data.offers : [];
  const cats = useMemo(() => [...new Set(offers.map((c) => c.category))], [offers]);
  const list = offers.filter((c) => cat === "all" || c.category === cat);
  const p = attachment.params;
  const d = airportByCode(p.destinationCode);

  return (
    <section className="results" aria-label="Rental car results">
      <SearchSummary kind="Rental cars" to={`${d?.city ?? p.destinationCode} airport`} dates={formatRange(p.pickUp, p.dropOff, locale)} people="Pick-up & return" currency={p.currency} />
      {res.status === "loading" && (
        <div className="hgrid">
          {[0, 1].map((i) => (
            <Skeleton key={i} h={300} r={16} />
          ))}
        </div>
      )}
      {res.status === "error" && (
        <div className="results__error">
          <span>{res.error}</span>
          <button className="btn btn--secondary btn--sm" onClick={res.retry}>
            <RotateCcw />
            Try again
          </button>
        </div>
      )}
      {res.status === "ok" && (
        <>
          <div className="toolbar toolbar--wrap">
            <div className="fset__chips" role="group" aria-label="Vehicle category">
              <button className="chip" aria-pressed={cat === "all"} onClick={() => setCat("all")}>
                All
              </button>
              {cats.map((c) => (
                <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>
            <div className="toolbar__end">
              <span className="t-meta num">{list.length} options</span>
            </div>
          </div>
          {list.length === 0 ? (
            <EmptyState icon={<Car />} title="No cars in this category" action={<button className="btn btn--secondary" onClick={() => setCat("all")}>Show all</button>} />
          ) : (
            <div className="hgrid">
              {list.map((c) => (
                <CarCard key={c.id} c={c} locale={locale} conversationId={conversationId} onSaved={onSaved} />
              ))}
            </div>
          )}
          <p className="results__fine">
            Demonstration estimates: supplier names are shown for illustration and prices aren&apos;t quotes. Availability, deposits, insurance and final price are confirmed by the rental company when you book.
          </p>
        </>
      )}
    </section>
  );
}

/** Renders only verified business records. Pyrius has no partnership with any listed business. */
export function LocalBusinessCard({ b }: { b: LocalBusiness }) {
  return (
    <article className="bcard">
      <div className="bcard__icon">{b.category === "Car dealership" ? <Building2 /> : <Car />}</div>
      <div className="bcard__body">
        <div className="t-eyebrow">{b.category}</div>
        <h3 className="t-h3">{b.name}</h3>
        <div className="t-meta">
          {b.address}
          {b.distanceKm !== undefined && <span className="num"> · {b.distanceKm} km</span>}
        </div>
      </div>
      <div className="bcard__actions">
        {b.phone && (
          <a className="btn btn--secondary btn--sm" href={`tel:${b.phone.replace(/\s/g, "")}`}>
            <Phone />
            Call
          </a>
        )}
        {b.website && (
          <a className="btn btn--secondary btn--sm" href={b.website} target="_blank" rel="noopener noreferrer">
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

export function BusinessDirectory({ attachment }: { attachment: BizAttachment }) {
  const res = useSearch<LocalBusinessResult>("businesses", { destinationCode: attachment.destinationCode, category: attachment.category });
  const dealer = attachment.category === "Car dealership";
  const city = airportByCode(attachment.destinationCode)?.city ?? attachment.destinationCode;

  return (
    <section className="results" aria-label={dealer ? "Car dealerships" : "Car rental agencies"}>
      <div className="summary">
        <div className="summary__route">
          <span className="t-eyebrow">Local directory</span>
          <div className="summary__places">
            <span>{dealer ? "Car dealerships" : "Car rental agencies"}</span>
          </div>
        </div>
        <div className="summary__meta">
          <span>
            <MapPin />
            {city}
          </span>
          {res.status === "ok" && res.data.source === "demo" && <DemoBadge label="No verified data source" />}
        </div>
      </div>
      {res.status === "loading" && <Skeleton h={180} r={16} />}
      {res.status === "error" && (
        <div className="results__error">
          <span>{res.error}</span>
          <button className="btn btn--secondary btn--sm" onClick={res.retry}>
            <RotateCcw />
            Try again
          </button>
        </div>
      )}
      {res.status === "ok" &&
        (res.data.businesses.length ? (
          <div className="results__list">
            {res.data.businesses.map((b) => (
              <LocalBusinessCard key={b.id} b={b} />
            ))}
          </div>
        ) : (
          <div className="directory-empty">
            <div className="directory-empty__art" aria-hidden="true">
              <MapPin />
            </div>
            <div className="directory-empty__text">
              <h3 className="t-h3">No verified listings connected yet</h3>
              <p className="t-body" style={{ fontSize: "var(--fs-sm)", marginTop: 4 }}>
                Rather than invent names, phone numbers or addresses, Pyrius shows businesses only from a verified directory (for example a Places API). Until one is connected, you can run the
                same search on Google Maps.
                {dealer && " Dealerships sell vehicles; for short trips a rental agency is usually what you need."}
              </p>
            </div>
            <a className="btn btn--primary" href={res.data.mapSearchUrl} target="_blank" rel="noopener noreferrer">
              Search {dealer ? "dealerships" : "agencies"} near {city}
              <ExternalLink />
            </a>
          </div>
        ))}
      <p className="results__fine">Businesses shown here are never partners or sponsors of Pyrius unless clearly stated.</p>
    </section>
  );
}
