"use client";
import { BedDouble, Coffee, Globe, MapPin, RotateCcw, ShieldCheck, SlidersHorizontal, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { DemoBadge, EmptyState, Skeleton, SmartImage } from "@/components/ui/primitives";
import { findAirport } from "@/lib/data/world";
import { useStore } from "@/lib/store/AppStore";
import type { Attachment, HotelOffer, HotelSnapshot } from "@/lib/types";
import { sortStays } from "@/lib/hotels/brief";
import { useSearch } from "@/lib/useSearch";
import { cx, formatRange, money } from "@/lib/utils";
import { SearchSummary } from "./FlightResults";
import { Price } from "@/components/ui/Price";
import { stagger } from "@/lib/motion";
import { OfferActions } from "./OfferActions";
import { SearchProgress, SourceLine } from "./SearchProgress";

type HotelAttachment = Extract<Attachment, { type: "hotels" }>;

interface Filters {
  sort: "price" | "luxury" | "rating" | "reviews";
  maxNight: number | null;
  minRating: number;
  types: string[];
  amenities: string[];
  freeCancel: boolean;
}

/** Amenity filters and the words Google Hotels uses for them. */
const AMENITY_FILTERS: [string, RegExp][] = [
  ["Free breakfast", /breakfast/i],
  ["Free Wi-Fi", /wi-?fi/i],
  ["Pool", /pool/i],
  ["Free parking", /parking/i],
  ["Spa", /spa\b/i],
  ["Fitness center", /fitness|gym/i],
  ["Kitchen", /kitchen/i],
  ["Beach access", /beach/i],
];

export function HotelCard({ h, conversationId, onSaved, locale, index = 0 }: { h: HotelOffer; conversationId?: string; onSaved?: (k: "flight" | "hotel" | "car") => void; locale: string; index?: number }) {
  const live = h.source === "live";
  return (
    <article className="hcard" data-glow style={stagger(index)}>
      <div className="hcard__media">
        <SmartImage src={h.image} alt={live ? `Photo of ${h.name}` : `Representative photo for ${h.name} (example)`} ratio="16 / 10" sizes="(max-width: 900px) 100vw, 440px" />
        <div className="hcard__overlay">
          <span className="badge hcard__type">{h.type}</span>
          {h.rating !== undefined && (
            <span className="hcard__rating num" title={live ? `Google rating from ${h.reviews?.toLocaleString(locale) ?? "guest"} reviews` : "Example rating — not a real guest review score"}>
              <Star />
              {h.rating.toFixed(1)}
              {live ? h.reviews !== undefined && <small>({h.reviews.toLocaleString(locale)})</small> : <small>example</small>}
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
        {(h.address || h.neighborhood) && (
          <div className="hcard__loc">
            <MapPin />
            <span>
              {h.address ?? `${h.neighborhood}, ${h.city}`}
              {h.distanceKm !== undefined && <span className="num"> · {h.distanceKm} km from centre</span>}
            </span>
          </div>
        )}
        {h.description && <p className="hcard__desc">{h.description}</p>}
        <div className="hcard__conds">
          {h.freeCancellation && (
            <span className="cond cond--good">
              <ShieldCheck />
              Free cancellation
            </span>
          )}
          {h.breakfastIncluded && (
            <span className="cond">
              <Coffee />
              Breakfast included
            </span>
          )}
          {h.amenities
            .filter((a) => !/breakfast/i.test(a))
            .slice(0, h.breakfastIncluded || h.freeCancellation ? 2 : 3)
            .map((a) => (
              <span key={a} className="cond">
                {a}
              </span>
            ))}
        </div>
        <div className="hcard__price">
          <div>
            <Price amount={h.pricePerNight} currency={h.currency} locale={locale} />
            <span className="t-meta"> / night</span>
          </div>
          <div className="t-meta num">
            {money(h.totalPrice, h.currency, locale)} total · {h.nights} night{h.nights > 1 ? "s" : ""}
            {h.link && (
              <>
                {" · "}
                <a className="hcard__site" href={h.link} target="_blank" rel="noopener noreferrer">
                  <Globe />
                  Website
                </a>
              </>
            )}
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
  // Results that came with the AI's reply are shown as they were found; older conversations search again.
  const res = useSearch<HotelSnapshot>("hotels", attachment.params, !attachment.snapshot);
  const snap: HotelSnapshot | null = attachment.snapshot ?? (res.status === "ok" ? res.data : null);
  const init: Filters = { sort: attachment.sort === "luxury" ? "luxury" : "price", maxNight: attachment.budgetPerNight ?? null, minRating: 0, types: [], amenities: [], freeCancel: false };
  const [f, setF] = useState<Filters>(init);
  const [sheet, setSheet] = useState(false);
  const set = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));
  const p = attachment.params;
  const offers = useMemo(() => snap?.offers ?? [], [snap]);
  const live = snap?.source === "live";

  const types = useMemo(() => [...new Set(offers.map((h) => h.type))], [offers]);
  const anyCancelInfo = offers.some((h) => h.freeCancellation);
  const prices = offers.map((h) => h.pricePerNight);
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 0;
  const ratingSteps = live ? [0, 3.5, 4, 4.5] : [0, 7, 8, 9];

  const list = useMemo(() => {
    const out = offers.filter(
      (h) =>
        (f.maxNight === null || h.pricePerNight <= f.maxNight) &&
        (h.rating ?? 0) >= f.minRating &&
        (!f.types.length || f.types.includes(h.type)) &&
        f.amenities.every((name) => {
          const re = AMENITY_FILTERS.find(([n]) => n === name)?.[1];
          return !re || h.amenities.some((a) => re.test(a)) || (name === "Free breakfast" && h.breakfastIncluded);
        }) &&
        (!f.freeCancel || h.freeCancellation),
    );
    if (f.sort === "price" || f.sort === "luxury") return sortStays(out, f.sort);
    return out.sort((a, b) => (f.sort === "rating" ? (b.rating ?? 0) - (a.rating ?? 0) : (b.reviews ?? 0) - (a.reviews ?? 0)));
  }, [offers, f]);

  const activeCount = [f.maxNight !== null, f.minRating > 0, f.types.length > 0, f.amenities.length > 0, f.freeCancel].filter(Boolean).length;
  const reset = () => setF({ ...init, maxNight: null, sort: f.sort });
  const noun = p.stayType === "apartment" ? "stays" : "hotels";

  const sections = (
    <>
      <fieldset className="fset">
        <legend className="fset__title">
          Max per night <span className="num" style={{ color: "var(--text)" }}>{money(f.maxNight ?? hi, p.currency, locale)}</span>
        </legend>
        <input className="range" type="range" min={lo} max={hi} step={5} value={Math.min(f.maxNight ?? hi, hi)} onChange={(e) => set({ maxNight: e.target.valueAsNumber >= hi ? null : e.target.valueAsNumber })} aria-label="Maximum price per night" />
      </fieldset>
      <fieldset className="fset">
        <legend className="fset__title">{live ? "Google rating" : "Example rating"}</legend>
        <div className="fset__chips">
          {ratingSteps.map((r) => (
            <button key={r} className="chip" aria-pressed={f.minRating === r} onClick={() => set({ minRating: r })}>
              {r ? `${r}+` : "Any"}
            </button>
          ))}
        </div>
      </fieldset>
      {types.length > 1 && (
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
      )}
      <fieldset className="fset">
        <legend className="fset__title">Amenities</legend>
        <div className="fset__chips">
          {AMENITY_FILTERS.map(([a]) => (
            <button key={a} className="chip" aria-pressed={f.amenities.includes(a)} onClick={() => set({ amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] })}>
              {a}
            </button>
          ))}
        </div>
        {anyCancelInfo && (
          <label className="check" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={f.freeCancel} onChange={(e) => set({ freeCancel: e.target.checked })} />
            Free cancellation only
          </label>
        )}
      </fieldset>
    </>
  );

  const d = findAirport(p.destinationCode);
  const loading = !snap && res.status === "loading";
  const error = !snap && res.status === "error" ? res : null;
  return (
    <section className="results" aria-label="Accommodation results">
      <SearchSummary
        kind={p.stayType === "apartment" ? "Stays" : "Hotels"}
        to={d?.city ?? p.destinationCode}
        dates={formatRange(p.checkIn, p.checkOut, locale)}
        people={`${p.guests} guest${p.guests > 1 ? "s" : ""}`}
        currency={p.currency}
        live={live}
      />
      {loading && (
        <SearchProgress what={noun}>
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
      {error && (
        <div className="results__error">
          <span>{error.error}</span>
          <button className="btn btn--secondary btn--sm" onClick={res.retry}>
            <RotateCcw />
            Try again
          </button>
        </div>
      )}
      {snap && (
        <>
          <SourceLine count={offers.length} noun={p.stayType === "apartment" ? "stays" : "properties"} live={live} provider={snap.provider} fetchedAt={snap.fetchedAt} note="Live prices · they can change until you book" />
          {!live && <DemoBadge label="Example data" />}
          {offers.length === 0 ? (
            <EmptyState icon={<BedDouble />} title={`No ${noun} with prices for these dates`} body="Google Hotels returned no bookable stays here for these dates. Try other dates or a nearby city." />
          ) : (
            <>
              <div className="toolbar">
                <div className="seg" role="group" aria-label="Sort by">
                  {(
                    [
                      ["price", "Price"],
                      ["luxury", "Luxury"],
                      ["rating", "Rating"],
                      ["reviews", "Popular"],
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
            </>
          )}
          <p className="results__fine">
            {live
              ? "Prices, ratings and photos come from Google Hotels for these dates and the number of guests. Book shows who sells the room and opens the cheapest site; the price is confirmed there before you pay."
              : "Example properties: names, photos, ratings and prices are illustrative and don't represent real listings, reviews or availability."}
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
