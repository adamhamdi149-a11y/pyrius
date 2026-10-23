"use client";
import { BadgeDollarSign, Bell, Bookmark, BookmarkCheck, Briefcase, Calendar, Car, ChevronDown, Luggage, MapPin, Minus, Plane, Plus, Search, ShieldCheck, Star, Users } from "lucide-react";
import { Fragment as F } from "react";
import { Orb } from "@/components/ai/Orb";
import { Price } from "@/components/ui/Price";
import type { CarOffer, FlightOffer, FlightSegment, HotelOffer, PricePoint } from "@/lib/types";
import { cx, formatDuration, formatTime, parseDate } from "@/lib/utils";
import type { FragKey, Turn } from "./scripts";

/* ---------- The old search form, in pieces ---------- */

export function FragmentView({ k }: { k: FragKey }) {
  switch (k) {
    case "to":
      return (
        <div className="ff ff--field">
          <span className="ff__label">To</span>
          <span className="ff__input">
            <MapPin />
            City or airport
          </span>
        </div>
      );
    case "from":
      return (
        <div className="ff ff--field">
          <span className="ff__label">From</span>
          <span className="ff__input">
            <Plane />
            Departure airport
          </span>
        </div>
      );
    case "dates":
      return (
        <div className="ff ff--cal">
          <span className="ff__label">
            <Calendar /> Depart — Return
          </span>
          <div className="ff__grid">
            {Array.from({ length: 21 }, (_, i) => (
              <i key={i}>{i + 1}</i>
            ))}
          </div>
        </div>
      );
    case "length":
      return (
        <div className="ff ff--row">
          <span className="ff__label">Trip length</span>
          <span className="ff__stepper">
            <Minus /> <b>— nights</b> <Plus />
          </span>
        </div>
      );
    case "flex":
      return (
        <div className="ff ff--row">
          <span className="ff__label">Flexible dates ± 3 days</span>
          <i className="ff__switch" />
        </div>
      );
    case "pax":
      return (
        <div className="ff ff--field">
          <span className="ff__label">Travelers &amp; class</span>
          <span className="ff__input">
            <Users />1 adult, Economy <ChevronDown />
          </span>
        </div>
      );
    case "budget":
      return (
        <div className="ff ff--range">
          <span className="ff__label">Max price</span>
          <span className="ff__track">
            <i />
          </span>
        </div>
      );
    case "stops":
      return (
        <div className="ff ff--chips">
          <span className="ff__label">Stops</span>
          <span>
            <em>Nonstop</em>
            <em>1 stop</em>
            <em>2+</em>
          </span>
        </div>
      );
    case "sort":
      return (
        <div className="ff ff--row">
          <span className="ff__label">Sort by</span>
          <span className="ff__select">
            Recommended <ChevronDown />
          </span>
        </div>
      );
    case "tabs":
      return (
        <div className="ff ff--tabs">
          <span>
            <Search /> Flights · results
          </span>
          <span>Compare (3)</span>
          <span>Flights · new dates</span>
          <b>+</b>
        </div>
      );
  }
}

/* ---------- Typed sentence with phrases that light up as their fields are replaced ---------- */

export function TypedSentence({ sentence, phrases, chars }: { sentence: string; phrases: { text: string }[]; chars: number }) {
  // Split the sentence into plain runs and phrase runs (case-insensitive match, first occurrence).
  const parts: { text: string; phrase: number | null }[] = [];
  let rest = sentence;
  let offset = 0;
  const lower = sentence.toLowerCase();
  const marks = phrases
    .map((p, i) => ({ i, at: lower.indexOf(p.text.toLowerCase()), len: p.text.length }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  for (const m of marks) {
    if (m.at < offset) continue;
    if (m.at > offset) parts.push({ text: sentence.slice(offset, m.at), phrase: null });
    parts.push({ text: sentence.slice(m.at, m.at + m.len), phrase: m.i });
    offset = m.at + m.len;
  }
  rest = sentence.slice(offset);
  if (rest) parts.push({ text: rest, phrase: null });

  let left = chars;
  return (
    <span className="ts" aria-label={sentence}>
      {parts.map((p, i) => {
        const shown = p.text.slice(0, Math.max(0, left));
        left -= p.text.length;
        if (!shown) return null;
        return p.phrase === null ? (
          <F key={i}>{shown}</F>
        ) : (
          <span key={i} className="ts__phrase" data-phrase={p.phrase} aria-hidden="true">
            {shown}
          </span>
        );
      })}
      {chars < sentence.length && <span className="ts__caret" aria-hidden="true" />}
    </span>
  );
}

/* ---------- Conversation, in the app's own visual language ---------- */

export function ConversationView({ turns, shown, thinking }: { turns: Turn[]; shown: number; thinking: boolean }) {
  return (
    <>
      {turns.slice(0, shown).map((t, i) =>
        t.role === "user" ? (
          <div key={i} className="cv cv--user">
            <div className="cv__bubble">{t.text}</div>
          </div>
        ) : (
          <div key={i} className="cv cv--ai">
            <span className="cv__avatar">
              <Orb size="sm" />
            </span>
            <div>
              <p className="cv__text">{t.text}</p>
              {t.chips && (
                <div className="cv__chips">
                  {t.chips.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ),
      )}
      {thinking && (
        <div className="cv cv--thinking" aria-hidden="true">
          <span className="thinking__dots">
            <i />
            <i />
            <i />
          </span>
        </div>
      )}
    </>
  );
}

/* ---------- Product cards: same classes as the app's results ---------- */

function dayShift(seg: FlightSegment) {
  const d = Math.round((parseDate(seg.arrive.slice(0, 10)).getTime() - parseDate(seg.depart.slice(0, 10)).getTime()) / 86400000);
  return d > 0 ? `+${d}` : "";
}

function Leg({ seg }: { seg: FlightSegment }) {
  const shift = dayShift(seg);
  return (
    <div className="leg">
      <div className="leg__pt">
        <b className="num">{formatTime(seg.depart)}</b>
        <span>{seg.from}</span>
      </div>
      <div className="leg__mid">
        <span className="leg__dur num">{formatDuration(seg.durationMin)}</span>
        <div className="leg__line">
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

export function MkFlightCard({ f, best, saved, compact }: { f: FlightOffer; best?: boolean; saved?: boolean; compact?: boolean }) {
  return (
    <article className={cx("fcard", "mk-fcard", best && "fcard--best", compact && "mk-fcard--compact")}>
      <div className="fcard__main">
        <div className="fcard__airline">
          <span className="airline-logo" style={{ ["--c" as string]: f.airline.color }}>
            {f.airline.code}
          </span>
          <div className="fcard__airline-text">
            <div className="fcard__name">{f.airline.name}</div>
            <div className="t-meta">{f.cabin}</div>
          </div>
        </div>
        <div className="fcard__legs">
          <Leg seg={f.outbound} />
          {!compact && f.inbound && <Leg seg={f.inbound} />}
        </div>
        <div className="fcard__price">
          {best && (
            <div className="fcard__tags">
              <span className="badge badge--accent">
                <BadgeDollarSign />
                Lowest in these results
              </span>
            </div>
          )}
          <Price amount={f.totalPrice} currency={f.currency} size="lg" />
          <div className="t-meta">illustrative · round trip</div>
        </div>
      </div>
      {!compact && (
        <div className="fcard__foot">
          <div className="fcard__facts">
            <span className={cx("fact", !f.baggage.carryOn && "fact--off")}>
              <Briefcase />
              {f.baggage.carryOn ? "Carry-on included" : "No carry-on"}
            </span>
            <span className={cx("fact", !f.baggage.checked && "fact--off")}>
              <Luggage />
              {f.baggage.checked ? `${f.baggage.checked} checked bag` : "No checked bag"}
            </span>
          </div>
          <div className="offer-actions" aria-hidden="true">
            <span className="action" aria-pressed={Boolean(saved)}>
              {saved ? <BookmarkCheck /> : <Bookmark />}
              {saved ? "Saved" : "Save"}
            </span>
            <span className="action">
              <Bell />
              Track price
            </span>
          </div>
        </div>
      )}
    </article>
  );
}

export function MkHotelCard({ h }: { h: HotelOffer }) {
  return (
    <article className="hcard mk-hcard">
      <div className="hcard__media">
        <div className="img" style={{ aspectRatio: "16 / 9" }}>
          <img src={h.image.replace("w=900", "w=700")} alt="" loading="lazy" data-loaded="true" />
        </div>
        <div className="hcard__overlay">
          <span className="badge hcard__type">{h.type}</span>
          {h.rating !== undefined && (
            <span className="hcard__rating num">
              <Star />
              {h.rating.toFixed(1)}
              <small>demo</small>
            </span>
          )}
        </div>
      </div>
      <div className="hcard__body">
        <h3 className="hcard__name">{h.name}</h3>
        <div className="hcard__loc">
          <MapPin />
          {h.neighborhood}, {h.city}
        </div>
        <div className="hcard__conds">{h.freeCancellation && <span className="cond cond--good"><ShieldCheck />Free cancellation</span>}</div>
        <div className="hcard__price">
          <div>
            <Price amount={h.pricePerNight} currency={h.currency} size="sm" />
            <span className="t-meta"> / night · illustrative</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function MkCarCard({ c }: { c: CarOffer }) {
  return (
    <article className="mk-car">
      <div className="img mk-car__img">
        <img src={c.image.replace("w=800", "w=500")} alt="" loading="lazy" data-loaded="true" />
      </div>
      <div className="mk-car__body">
        <span className="t-eyebrow">{c.category}</span>
        <b>{c.example}</b>
        <span className="t-meta">
          <Car style={{ width: 13, height: 13, display: "inline", verticalAlign: -2 }} /> {c.supplier} · {c.days} days
        </span>
        <Price amount={c.totalPrice} currency={c.currency} size="sm" />
      </div>
    </article>
  );
}

/** Price history chart drawn as a path; `drawId` lets the film animate its stroke. */
export function MkChart({ history, target }: { history: PricePoint[]; target: number }) {
  const W = 520;
  const H = 200;
  const prices = history.map((p) => p.price);
  const lo = Math.min(...prices, target) * 0.97;
  const hi = Math.max(...prices, target) * 1.03;
  const x = (i: number) => 10 + (i / (history.length - 1)) * (W - 20);
  const y = (v: number) => 14 + (1 - (v - lo) / (hi - lo)) * (H - 28);
  const d = history.reduce((acc, p, i) => {
    const px = x(i);
    const py = y(p.price);
    if (i === 0) return `M${px},${py}`;
    const cx = (x(i - 1) + px) / 2;
    return `${acc} C${cx},${y(history[i - 1].price)} ${cx},${py} ${px},${py}`;
  }, "");
  const last = history.at(-1)!;
  return (
    <svg className="mk-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Illustrative price history with a target price line">
      <defs>
        <linearGradient id="mkChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="10" x2={W - 10} y1={14 + f * (H - 28)} y2={14 + f * (H - 28)} className="mk-chart__grid" />
      ))}
      <path d={`${d} L${x(history.length - 1)},${H - 14} L${x(0)},${H - 14} Z`} fill="url(#mkChartFill)" className="mk-chart__area" />
      <path d={d} className="mk-chart__line" pathLength={1} />
      <line x1="10" x2={W - 10} y1={y(target)} y2={y(target)} className="mk-chart__target" />
      <circle cx={x(history.length - 1)} cy={y(last.price)} r="5" className="mk-chart__dot" />
    </svg>
  );
}
