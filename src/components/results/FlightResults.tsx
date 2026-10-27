"use client";
import { AlertTriangle, ArrowRight, Briefcase, CalendarDays, ChevronDown, Clock, Luggage, Pencil, Plane, Radio, RotateCcw, SlidersHorizontal, Users, Zap, BadgeDollarSign } from "lucide-react";
import { useMemo, useState } from "react";
import { authHeaders } from "@/lib/authHeaders";
import { Dialog } from "@/components/ui/Dialog";
import { DemoBadge, EmptyState, Skeleton, useDismiss } from "@/components/ui/primitives";
import { findAirport } from "@/lib/data/world";
import { useStore } from "@/lib/store/AppStore";
import type { Attachment, FlightOffer, FlightSegment, FlightSnapshot } from "@/lib/types";
import { useSearch } from "@/lib/useSearch";
import { cx, formatDuration, formatRange, formatTime, money, parseDate } from "@/lib/utils";
import { Price } from "@/components/ui/Price";
import { stagger } from "@/lib/motion";
import { applyFlightFilters, WINDOWS, type Filters, type Sort, type Stops, type Window } from "@/lib/flights/filters";
import { OfferActions } from "./OfferActions";
import { SearchProgress, SourceLine } from "./SearchProgress";

type FlightAttachment = Extract<Attachment, { type: "flights" }>;
export { applyFlightFilters };

function dayShift(seg: FlightSegment) {
  const d = Math.round((parseDate(seg.arrive.slice(0, 10)).getTime() - parseDate(seg.depart.slice(0, 10)).getTime()) / 86400000);
  return d > 0 ? `+${d}` : d < 0 ? `${d}` : "";
}

function Leg({ seg, label }: { seg: FlightSegment; label: string }) {
  const shift = dayShift(seg);
  return (
    <div className="leg">
      <div className="leg__pt">
        <b className="num">{formatTime(seg.depart)}</b>
        <span>{seg.from}</span>
      </div>
      <div className="leg__mid" aria-label={`${label}: ${formatDuration(seg.durationMin)}, ${seg.stops ? `${seg.stops} stop${seg.stops > 1 ? "s" : ""}` : "nonstop"}`}>
        <span className="leg__dur num">{formatDuration(seg.durationMin)}</span>
        <div className="leg__line" aria-hidden="true">
          {seg.stopCodes.map((s) => (
            <i key={s} />
          ))}
          <Plane />
        </div>
        <span className={cx("leg__stops", seg.stops === 0 && "leg__stops--direct")}>
          {seg.stops === 0 ? (
            "Nonstop"
          ) : (
            <>
              <b>{`${seg.stops} stop${seg.stops > 1 ? "s" : ""}`}</b> · {seg.stopCodes.join(", ")}
            </>
          )}
        </span>
      </div>
      <div className="leg__pt leg__pt--end">
        <b className="num">
          {formatTime(seg.arrive)}
          {shift && <sup>{shift}</sup>}
        </b>
        <span>{seg.to}</span>
      </div>
    </div>
  );
}

export function FlightCard({ offer, tags, conversationId, onSaved, locale, index = 0, onExpired }: { offer: FlightOffer; tags: ("cheapest" | "fastest")[]; conversationId?: string; onSaved?: (k: "flight" | "hotel" | "car") => void; locale: string; index?: number; onExpired?: () => void }) {
  const highlight = tags.includes("cheapest");
  return (
    <article className={cx("fcard", highlight && "fcard--best")} data-glow style={stagger(index)} aria-label={`${offer.airline.name}, ${money(offer.totalPrice, offer.currency, locale)}`}>
      <div className="fcard__main">
        <div className="fcard__airline">
          <span className="airline-logo" style={{ ["--c" as string]: offer.airline.color }} aria-hidden="true" data-img={Boolean(offer.airline.logo)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {offer.airline.logo ? <img src={offer.airline.logo} alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer" /> : offer.airline.code}
          </span>
          <div className="fcard__airline-text">
            <div className="fcard__name">{offer.airline.name}</div>
            <div className="t-meta">{offer.cabin}</div>
          </div>
        </div>
        <div className="fcard__legs">
          <Leg seg={offer.outbound} label="Outbound" />
          {offer.inbound && <Leg seg={offer.inbound} label="Return" />}
        </div>
        <div className="fcard__price">
          {tags.length > 0 && (
            <div className="fcard__tags">
              {tags.includes("cheapest") && (
                <span className="badge badge--accent">
                  <BadgeDollarSign />
                  Lowest in these results
                </span>
              )}
              {tags.includes("fastest") && (
                <span className="badge">
                  <Zap />
                  Shortest trip
                </span>
              )}
            </div>
          )}
          <Price amount={offer.totalPrice} currency={offer.currency} locale={locale} size="lg" />
          <div className="t-meta num">
            {offer.travelers > 1 ? `${money(offer.pricePerTraveler, offer.currency, locale)} / traveler · ` : ""}
            {offer.inbound || offer.tripType === "round" ? "round trip" : "one way"}
          </div>
          {offer.returnPending && <div className="t-meta fcard__pending">With the cheapest return</div>}
        </div>
      </div>
      <div className="fcard__foot">
        <div className="fcard__facts">
          {offer.baggage ? (
            <>
              <span className={cx("fact", !offer.baggage.carryOn && "fact--off")}>
                <Briefcase />
                {offer.baggage.carryOn ? "Carry-on included" : "No carry-on"}
              </span>
              <span className={cx("fact", !offer.baggage.checked && "fact--off")}>
                <Luggage />
                {offer.baggage.checked ? `${offer.baggage.checked} checked bag${offer.baggage.checked > 1 ? "s" : ""}` : "No checked bag"}
              </span>
            </>
          ) : (
            <span className="fact fact--muted" title="As reported by Google Flights. The seller confirms baggage rules when you book.">
              <Luggage />
              {offer.conditions?.find((c) => /bag/i.test(c)) ?? "Bags shown when booking"}
            </span>
          )}
          {offer.conditions
            ?.filter((c) => /refund|change/i.test(c))
            .slice(0, 1)
            .map((c) => (
              <span key={c} className="fact fact--muted">
                {c}
              </span>
            ))}
          <span className="fact fact--muted">{offer.outbound.flightNumber}</span>
          {offer.notes?.slice(0, 1).map((n) => (
            <span key={n} className="fact fact--warn">
              <AlertTriangle />
              {n}
            </span>
          ))}
        </div>
        <OfferActions offer={{ kind: "flight", offer }} conversationId={conversationId} onSaved={onSaved} onExpired={onExpired} />
      </div>
    </article>
  );
}

function FlightSkeleton() {
  return (
    <div className="results__list" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="fcard" style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Skeleton w={36} h={36} r={10} />
            <div style={{ flex: 1, display: "grid", gap: 8 }}>
              <Skeleton w="40%" h={12} />
              <Skeleton w="70%" h={10} />
            </div>
            <Skeleton w={90} h={26} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Pop({ label, active, children, align }: { label: string; active?: boolean; children: React.ReactNode; align?: "end" }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className={cx("filter-btn", active && "filter-btn--on")} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
        <ChevronDown />
      </button>
      {open && <div className={cx("popover filter-pop", align === "end" && "filter-pop--end")}>{children}</div>}
    </div>
  );
}

function FilterSections({ f, set, offers, locale, only }: { f: Filters; set: (p: Partial<Filters>) => void; offers: FlightOffer[]; locale: string; only?: "stops" | "window" | "airlines" | "price" }) {
  const airlines = useMemo(() => {
    const m = new Map<string, { name: string; count: number; low: number }>();
    offers.forEach((o) => {
      const e = m.get(o.airline.code) ?? { name: o.airline.name, count: 0, low: Infinity };
      e.count++;
      e.low = Math.min(e.low, o.totalPrice);
      m.set(o.airline.code, e);
    });
    return [...m.entries()].sort((a, b) => a[1].low - b[1].low);
  }, [offers]);
  const prices = offers.map((o) => o.totalPrice);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const cur = offers[0]?.currency ?? "CAD";

  return (
    <>
      {(!only || only === "stops") && (
        <fieldset className="fset">
          <legend className="fset__title">Stops</legend>
          <div className="fset__chips">
            {(
              [
                ["any", "Any number"],
                ["0", "Nonstop only"],
                ["1", "1 stop or fewer"],
              ] as const
            ).map(([k, l]) => (
              <button key={k} className="chip" aria-pressed={f.stops === k} onClick={() => set({ stops: k })}>
                {l}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {(!only || only === "window") && (
        <fieldset className="fset">
          <legend className="fset__title">Departure time</legend>
          <div className="fset__chips">
            {(["any", "morning", "afternoon", "evening"] as const).map((w) => (
              <button key={w} className="chip" aria-pressed={f.window === w} onClick={() => set({ window: w })}>
                {w === "any" ? "Any time" : WINDOWS[w][2]}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {(!only || only === "airlines") && (
        <fieldset className="fset">
          <legend className="fset__title">Airlines</legend>
          {airlines.map(([code, a]) => (
            <label key={code} className="check">
              <input
                type="checkbox"
                checked={f.airlines.length === 0 || f.airlines.includes(code)}
                onChange={(e) => {
                  const all = airlines.map(([c]) => c);
                  const current = f.airlines.length ? f.airlines : all;
                  const next = e.target.checked ? [...current, code] : current.filter((c) => c !== code);
                  set({ airlines: next.length === all.length ? [] : next });
                }}
              />
              <span style={{ flex: 1 }}>{a.name}</span>
              <span className="t-meta num">from {money(a.low, cur, locale)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {(!only || only === "price") && (
        <fieldset className="fset">
          <legend className="fset__title">
            Maximum total price <span className="num" style={{ color: "var(--text)" }}>{money(f.maxPrice ?? hi, cur, locale)}</span>
          </legend>
          <input
            className="range"
            type="range"
            min={lo}
            max={hi}
            step={10}
            value={f.maxPrice ?? hi}
            onChange={(e) => set({ maxPrice: e.target.valueAsNumber >= hi ? null : e.target.valueAsNumber })}
            aria-label="Maximum total price"
          />
          <div className="range-ends num">
            <span>{money(lo, cur, locale)}</span>
            <span>{money(hi, cur, locale)}</span>
          </div>
          <label className="check" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={f.carryOn} onChange={(e) => set({ carryOn: e.target.checked })} />
            Carry-on bag included
          </label>
        </fieldset>
      )}
    </>
  );
}

export function SearchSummary({
  from,
  to,
  dates,
  people,
  currency,
  onEdit,
  kind = "Flights",
  live,
}: {
  from?: string;
  to: string;
  dates: string;
  people: string;
  currency: string;
  onEdit?: () => void;
  kind?: string;
  /** Results from a live provider rather than demo or example data. */
  live?: boolean;
}) {
  return (
    <div className="summary">
      <div className="summary__route">
        <span className="t-eyebrow">{kind}</span>
        <div className="summary__places">
          {from && (
            <>
              <span>{from}</span>
              <ArrowRight />
            </>
          )}
          <span>{to}</span>
        </div>
      </div>
      <div className="summary__meta">
        <span>
          <CalendarDays />
          {dates}
        </span>
        <span>
          <Users />
          {people}
        </span>
        <span className="num">{currency}</span>
        {live ? (
          <span className="badge badge--live" title="Current fares from Google Flights">
            <Radio />
            Live fares
          </span>
        ) : (
          <DemoBadge />
        )}
      </div>
      {onEdit && (
        <button className="btn btn--ghost btn--sm summary__edit" onClick={onEdit} aria-label="Edit search">
          <Pencil />
          <span>Edit search</span>
        </button>
      )}
    </div>
  );
}

export function FlightResults({ attachment, conversationId, onSaved, onEdit }: { attachment: FlightAttachment; conversationId?: string; onSaved?: (k: "flight" | "hotel" | "car") => void; onEdit?: () => void }) {
  const { settings } = useStore();
  // Results that came with the reply are shown as they were found; others (and refreshes) are searched here.
  const [fresh, setFresh] = useState<FlightSnapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const stored = fresh ?? attachment.snapshot ?? null;
  const res = useSearch<FlightSnapshot>("flights", attachment.params, !stored);
  const snap: FlightSnapshot | null = stored ?? (res.status === "ok" ? res.data : null);
  const live = snap?.source === "live";
  const stale = live && Date.now() - Date.parse(snap!.fetchedAt) > 30 * 60_000;
  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const r = await fetch("/api/search/flights", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(attachment.params) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || "The search couldn't be completed.");
      setFresh(body as FlightSnapshot);
    } catch (err) {
      setRefreshError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  };
  const init: Filters = {
    sort: attachment.filters?.sort ?? "price",
    stops: attachment.filters?.nonstopOnly ? "0" : "any",
    window: "any",
    airlines: [],
    maxPrice: null,
    carryOn: Boolean(attachment.filters?.carryOnOnly),
  };
  const [f, setF] = useState<Filters>(init);
  const [sheet, setSheet] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const set = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));
  const p = attachment.params;
  const locale = settings.locale;
  const o = findAirport(p.originCode);
  const d = findAirport(p.destinationCode);
  const travelers = p.adults + p.children;

  const offers = useMemo(() => snap?.offers ?? [], [snap]);
  const list = useMemo(() => applyFlightFilters([...offers], f), [offers, f]);
  const cheapestId = useMemo(() => offers.reduce<FlightOffer | null>((a, b) => (!a || b.totalPrice < a.totalPrice ? b : a), null)?.id, [offers]);
  const fastestId = useMemo(
    () => offers.reduce<FlightOffer | null>((a, b) => (!a || b.outbound.durationMin + (b.inbound?.durationMin ?? 0) < a.outbound.durationMin + (a.inbound?.durationMin ?? 0) ? b : a), null)?.id,
    [offers],
  );
  const activeCount = [f.stops !== "any", f.window !== "any", f.airlines.length > 0, f.maxPrice !== null, f.carryOn].filter(Boolean).length;
  const visible = showAll ? list : list.slice(0, 6);
  const budgetFit = attachment.budget ? offers.filter((x) => x.totalPrice <= attachment.budget!).length : null;

  return (
    <section className="results" aria-label="Flight results">
      <SearchSummary
        from={o ? `${o.city} ${o.code}` : p.originCode}
        to={d ? `${d.city} ${d.code}` : p.destinationCode}
        dates={formatRange(p.departDate, p.returnDate, locale)}
        people={`${travelers} traveler${travelers > 1 ? "s" : ""}`}
        currency={p.currency}
        onEdit={onEdit}
        live={live}
      />

      {!snap && res.status === "loading" && (
        <SearchProgress what={`flights ${p.originCode} → ${p.destinationCode}`} source="Flight search">
          <FlightSkeleton />
        </SearchProgress>
      )}
      {!snap && res.status === "error" && (
        <div className="results__error" role="alert">
          <span>{res.error}</span>
          {res.code !== "not_configured" && (
            <button className="btn btn--secondary btn--sm" onClick={res.retry}>
              <RotateCcw />
              Try again
            </button>
          )}
        </div>
      )}
      {snap && stale && (
        <div className="results__stale" role="status">
          <Clock />
          <span>
            These fares were retrieved at {new Date(snap.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Prices and seats may have changed.
          </span>
          <button className="btn btn--secondary btn--sm" onClick={refresh} disabled={refreshing}>
            <RotateCcw />
            {refreshing ? "Refreshing…" : "Refresh prices"}
          </button>
        </div>
      )}
      {refreshError && (
        <div className="results__error" role="alert">
          <span>{refreshError}</span>
          <button className="btn btn--secondary btn--sm" onClick={refresh} disabled={refreshing}>
            <RotateCcw />
            Try again
          </button>
        </div>
      )}
      {snap && offers.length === 0 && (
        <EmptyState icon={<Plane />} title="No flights found" body="No flights were returned for this route and these dates. Try other dates, a nearby airport, or allowing stops." />
      )}
      {snap && offers.length > 0 && (
        <>
          <div className="toolbar">
            <div className="seg" role="group" aria-label="Sort by">
              {(
                [
                  ["price", "Lowest price"],
                  ["duration", "Shortest"],
                  ["depart", "Earliest"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} aria-pressed={f.sort === k} onClick={() => set({ sort: k })}>
                  {l}
                </button>
              ))}
            </div>
            <div className="toolbar__desk toolbar__pops" role="group" aria-label="Filters">
              <Pop label={f.stops === "any" ? "Stops" : f.stops === "0" ? "Nonstop" : "≤ 1 stop"} active={f.stops !== "any"}>
                <FilterSections f={f} set={set} offers={offers} locale={locale} only="stops" />
              </Pop>
              <Pop label={f.window === "any" ? "Departure" : WINDOWS[f.window][2].split(" ·")[0]} active={f.window !== "any"}>
                <FilterSections f={f} set={set} offers={offers} locale={locale} only="window" />
              </Pop>
              <Pop label={f.airlines.length ? `Airlines · ${f.airlines.length}` : "Airlines"} active={f.airlines.length > 0}>
                <FilterSections f={f} set={set} offers={offers} locale={locale} only="airlines" />
              </Pop>
              <Pop label={f.maxPrice !== null ? `≤ ${money(f.maxPrice, p.currency, locale)}` : "Price & bags"} active={f.maxPrice !== null || f.carryOn} align="end">
                <FilterSections f={f} set={set} offers={offers} locale={locale} only="price" />
              </Pop>
            </div>
            <button className={cx("filter-btn toolbar__mob", activeCount > 0 && "filter-btn--on")} onClick={() => setSheet(true)}>
              <SlidersHorizontal />
              {activeCount ? `Filters · ${activeCount}` : "Filters"}
            </button>
          </div>

          <SourceLine count={offers.length} noun="offers" ms={res.status === "ok" ? res.ms : undefined} live={live} provider={snap.provider} fetchedAt={snap.fetchedAt} />
          <div className="results__meta">
            <span className="num">
              <b>{list.length}</b> of {offers.length} flights
            </span>
            {budgetFit !== null && (
              <span>
                {budgetFit > 0
                  ? `${budgetFit} within your ${money(attachment.budget!, p.currency, locale)} budget`
                  : `None within ${money(attachment.budget!, p.currency, locale)}${live ? "" : " in this demo data"}`}
                {budgetFit > 0 && f.maxPrice === null && (
                  <button className="link-btn" onClick={() => set({ maxPrice: attachment.budget! })}>
                    Show only those
                  </button>
                )}
              </span>
            )}
            {activeCount > 0 && (
              <button className="link-btn results__reset" onClick={() => setF({ ...init, stops: "any", carryOn: false, sort: f.sort })}>
                <RotateCcw />
                Clear filters
              </button>
            )}
          </div>

          {list.length === 0 ? (
            <EmptyState
              icon={<SlidersHorizontal />}
              title="No flights match these filters"
              body="Try allowing a stop, widening the departure window or raising the price limit."
              action={
                <button className="btn btn--secondary" onClick={() => setF({ ...init, stops: "any", carryOn: false })}>
                  Reset filters
                </button>
              }
            />
          ) : (
            <div className="results__list m-stagger">
              {visible.map((offer, i) => (
                <FlightCard
                  key={offer.id}
                  index={i}
                  offer={offer}
                  locale={locale}
                  conversationId={conversationId}
                  onSaved={onSaved}
                  onExpired={refresh}
                  tags={[...(offer.id === cheapestId ? (["cheapest"] as const) : []), ...(offer.id === fastestId ? (["fastest"] as const) : [])]}
                />
              ))}
            </div>
          )}
          {list.length > 6 && (
            <button className="btn btn--ghost results__more" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Show fewer" : `Show ${list.length - 6} more flights`}
            </button>
          )}
          <p className="results__fine">
            {live
              ? "Live fares from Google Flights at the time shown. Prices and seats can change until you book. Pyrius doesn't sell tickets: Book shows who sells each itinerary and takes you to their site."
              : "Demonstration offers generated for testing — not live fares or seat availability. Pyrius doesn't sell tickets; you'll compare and book with the airline or a booking site."}
          </p>

          <Dialog
            open={sheet}
            onClose={() => setSheet(false)}
            title="Filters"
            sheet
            footer={
              <>
                <button className="btn btn--ghost" onClick={() => setF({ ...init, stops: "any", carryOn: false, sort: f.sort })}>
                  Reset
                </button>
                <button className="btn btn--primary" onClick={() => setSheet(false)}>
                  Show {list.length} flights
                </button>
              </>
            }
          >
            <FilterSections f={f} set={set} offers={offers} locale={locale} />
          </Dialog>
        </>
      )}
    </section>
  );
}
