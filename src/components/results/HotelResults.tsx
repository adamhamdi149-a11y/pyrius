"use client";
import { BedDouble, Coffee, MapPin, RotateCcw, ShieldCheck, SlidersHorizontal, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState, Skeleton, SmartImage } from "@/components/ui/primitives";
import { airportByCode } from "@/lib/data/catalog";
import { useStore } from "@/lib/store/AppStore";
import type { Attachment, HotelOffer } from "@/lib/types";
import { useSearch } from "@/lib/useSearch";
import { cx, formatRange, money } from "@/lib/utils";
import { SearchSummary } from "./FlightResults";
import { Price } from "@/components/ui/Price";
import { stagger } from "@/lib/motion";
import { OfferActions } from "./OfferActions";
import { SearchProgress, SourceLine } from "./SearchProgress";

type HotelAttachment = Extract<Attachment, { type: "hotels" }>;

interface Filters {
  sort: "price" | "rating" | "distance";
  maxNight: number | null;
  minRating: 0 | 7 | 8 | 9;
  hood: string;
  types: string[];
  amenities: string[];
  freeCancel: boolean;
}

const AMENITY_FILTERS = ["Free Wi-Fi", "Pool", "Kitchen", "Gym", "Spa", "Breakfast"];

export function HotelCard({ h, conversationId, onSaved, locale, index = 0 }: { h: HotelOffer; conversationId?: string; onSaved?: (k: "flight" | "hotel" | "car") => void; locale: string; index?: number }) {
  return (
    <article className="hcard" data-glow style={stagger(index)}>
      <div className="hcard__media">
        <SmartImage src={h.image} alt={`Representative photo for ${h.name} (demo)`} ratio="16 / 10" sizes="(max-width: 900px) 100vw, 440px" />
        <div className="hcard__overlay">
          <span className="badge hcard__type">{h.type}</span>
          {h.rating !== undefined && (
            <span className="hcard__rating num" title="Demo rating — not a real guest review score">
              <Star />
              {h.rating.toFixed(1)}
              <small>demo</small>
            </span>
          )}
        </div>
      </div>
      <div className="hcard__body">
        <div className="hcard__head">
          <h3 className="hcard__name">{h.name}</h3>
          {h.stars > 0 && (
            <span className="hcard__stars" aria-label={`${h.stars}-star property`}>
              {"★".repeat(h.stars)}
            </span>
          )}
        </div>
        <div className="hcard__loc">
          <MapPin />
          {h.neighborhood} · <span className="num">{h.distanceKm} km</span> from centre
        </div>
        <p className="hcard__desc">{h.description}</p>
        <div className="hcard__conds">
          {h.freeCancellation ? (
            <span className="cond cond--good">
              <ShieldCheck />
              Free cancellation
            </span>
          ) : (
            <span className="cond">Non-refundable</span>
          )}
          {h.breakfastIncluded && (
            <span className="cond">
              <Coffee />
              Breakfast included
            </span>
          )}
        </div>
        <div className="hcard__price">
          <div>
            <Price amount={h.pricePerNight} currency={h.currency} locale={locale} />
            <span className="t-meta"> / night</span>
          </div>
          <div className="t-meta num">
            {money(h.totalPrice, h.currency, locale)} total · {h.nights} night{h.nights > 1 ? "s" : ""}
          </div>
        </div>
        <OfferActions offer={{ kind: "hotel", offer: h }} conversationId={conversationId} onSaved={onSaved} compact />
      </div>
    </article>
  );
}

export function HotelResults({ attachment, conversationId, onSaved }: { attachment: HotelAttachment; conversationId?: string; onSaved?: (k: "flight" | "hotel" | "car") => void }) {
  const { settings } = useStore();
  const locale = settings.locale;
  const res = useSearch<{ offers: HotelOffer[] }>("hotels", attachment.params);
  const init: Filters = { sort: "price", maxNight: attachment.budgetPerNight ?? null, minRating: 0, hood: "all", types: [], amenities: [], freeCancel: false };
  const [f, setF] = useState<Filters>(init);
  const [sheet, setSheet] = useState(false);
  const set = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));
  const p = attachment.params;
  const offers = res.status === "ok" ? res.data.offers : [];

  const hoods = useMemo(() => [...new Set(offers.map((h) => h.neighborhood))].sort(), [offers]);
  const types = useMemo(() => [...new Set(offers.map((h) => h.type))], [offers]);
  const prices = offers.map((h) => h.pricePerNight);
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 0;

  const list = useMemo(() => {
    const out = offers.filter(
      (h) =>
        (f.maxNight === null || h.pricePerNight <= f.maxNight) &&
        (h.rating ?? 0) >= f.minRating &&
        (f.hood === "all" || h.neighborhood === f.hood) &&
        (!f.types.length || f.types.includes(h.type)) &&
        f.amenities.every((a) => (a === "Breakfast" ? h.breakfastIncluded : h.amenities.includes(a))) &&
        (!f.freeCancel || h.freeCancellation),
    );
    return out.sort((a, b) => (f.sort === "rating" ? (b.rating ?? 0) - (a.rating ?? 0) : f.sort === "distance" ? a.distanceKm - b.distanceKm : a.pricePerNight - b.pricePerNight));
  }, [offers, f]);

  const activeCount = [f.maxNight !== null, f.minRating > 0, f.hood !== "all", f.types.length > 0, f.amenities.length > 0, f.freeCancel].filter(Boolean).length;
  const reset = () => setF({ ...init, maxNight: null, sort: f.sort });

  const sections = (
    <>
      <fieldset className="fset">
        <legend className="fset__title">
          Max per night <span className="num" style={{ color: "var(--text)" }}>{money(f.maxNight ?? hi, p.currency, locale)}</span>
        </legend>
        <input className="range" type="range" min={lo} max={hi} step={5} value={Math.min(f.maxNight ?? hi, hi)} onChange={(e) => set({ maxNight: e.target.valueAsNumber >= hi ? null : e.target.valueAsNumber })} aria-label="Maximum price per night" />
      </fieldset>
      <fieldset className="fset">
        <legend className="fset__title">Demo rating</legend>
        <div className="fset__chips">
          {([0, 7, 8, 9] as const).map((r) => (
            <button key={r} className="chip" aria-pressed={f.minRating === r} onClick={() => set({ minRating: r })}>
              {r ? `${r}+` : "Any"}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="fset">
        <legend className="fset__title">Neighborhood</legend>
        <select className="select" value={f.hood} onChange={(e) => set({ hood: e.target.value })} aria-label="Neighborhood">
          <option value="all">All neighborhoods</option>
          {hoods.map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </fieldset>
      <fieldset className="fset">
        <legend className="fset__title">Property type</legend>
        <div className="fset__chips">
          {types.map((t) => (
            <button key={t} className="chip" aria-pressed={f.types.includes(t)} onClick={() => set({ types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t] })}>
              {t}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="fset">
        <legend className="fset__title">Amenities</legend>
        <div className="fset__chips">
          {AMENITY_FILTERS.map((a) => (
            <button key={a} className="chip" aria-pressed={f.amenities.includes(a)} onClick={() => set({ amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] })}>
              {a}
            </button>
          ))}
        </div>
        <label className="check" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={f.freeCancel} onChange={(e) => set({ freeCancel: e.target.checked })} />
          Free cancellation only
        </label>
      </fieldset>
    </>
  );

  const d = airportByCode(p.destinationCode);
  return (
    <section className="results" aria-label="Accommodation results">
      <SearchSummary
        kind={p.stayType === "apartment" ? "Stays" : "Hotels"}
        to={d?.city ?? p.destinationCode}
        dates={formatRange(p.checkIn, p.checkOut, locale)}
        people={`${p.guests} guest${p.guests > 1 ? "s" : ""} · ${p.rooms} room${p.rooms > 1 ? "s" : ""}`}
        currency={p.currency}
      />
      {res.status === "loading" && (
        <SearchProgress what={p.stayType === "apartment" ? "stays" : "hotels"}>
        <div className="hgrid" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="hcard">
              <Skeleton h={0} style={{ aspectRatio: "16 / 10", borderRadius: 0 }} />
              <div className="hcard__body">
                <Skeleton w="60%" h={14} />
                <Skeleton w="40%" h={10} />
                <Skeleton w="90%" h={10} />
              </div>
            </div>
          ))}
        </div>
        </SearchProgress>
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
          <SourceLine count={offers.length} noun={p.stayType === "apartment" ? "stays" : "properties"} ms={res.ms} />
          <div className="toolbar">
            <div className="seg" role="group" aria-label="Sort by">
              {(
                [
                  ["price", "Price"],
                  ["rating", "Rating"],
                  ["distance", "Distance"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} aria-pressed={f.sort === k} onClick={() => set({ sort: k })}>
                  {l}
                </button>
              ))}
            </div>
            <button className={cx("filter-btn", activeCount > 0 && "filter-btn--on")} onClick={() => setSheet(true)}>
              <SlidersHorizontal />
              {activeCount ? `Filters · ${activeCount}` : "Filters"}
            </button>
            <div className="toolbar__end">
              <span className="t-meta num">
                {list.length} of {offers.length}
              </span>
              {activeCount > 0 && (
                <button className="btn btn--ghost btn--sm" onClick={reset}>
                  Reset
                </button>
              )}
            </div>
          </div>
          {list.length === 0 ? (
            <EmptyState icon={<BedDouble />} title="No stays match these filters" body="Try a higher nightly limit or fewer amenities." action={<button className="btn btn--secondary" onClick={reset}>Reset filters</button>} />
          ) : (
            <div className="hgrid m-stagger">
              {list.map((h, i) => (
                <HotelCard key={h.id} h={h} index={i} locale={locale} conversationId={conversationId} onSaved={onSaved} />
              ))}
            </div>
          )}
          <p className="results__fine">
            Demonstration properties: names, photos, ratings and prices are illustrative and don&apos;t represent real listings, reviews or availability. Photos are representative stock images.
          </p>
          <Dialog
            open={sheet}
            onClose={() => setSheet(false)}
            title="Filter stays"
            wide
            footer={
              <>
                <button className="btn btn--ghost" onClick={reset}>
                  Reset
                </button>
                <button className="btn btn--primary" onClick={() => setSheet(false)}>
                  Show {list.length} stays
                </button>
              </>
            }
          >
            {sections}
          </Dialog>
        </>
      )}
    </section>
  );
}
