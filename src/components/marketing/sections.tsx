"use client";
import { ArrowRight, Check, ChevronDown, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Orb } from "@/components/ai/Orb";
import { planPrice, PLANS, usd, YEARLY_SAVING } from "@/lib/plans";
import type { BillingInterval } from "@/lib/types";
import { useStore } from "@/lib/store/AppStore";
import { FAQS, type FaqItem } from "./faq";
import { carryDraft } from "./useTryHref";

const goto = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  window.dispatchEvent(new CustomEvent("mk:goto", { detail: id }));
};

/* ---------- Pricing: the same plan catalogue the app bills from ---------- */

/** Monthly · [switch] · Annually. A real switch, so it reads and works the same with a keyboard or screen reader. */
export function BillingSwitch({ interval, onChange, saving }: { interval: BillingInterval; onChange: (i: BillingInterval) => void; saving?: number }) {
  const yearly = interval === "year";
  return (
    <div className="mk-billing">
      <button type="button" className="mk-billing__label" data-on={!yearly} onClick={() => onChange("month")}>
        Monthly
      </button>
      <button type="button" role="switch" aria-checked={yearly} aria-label="Bill annually" className="mk-billing__switch" onClick={() => onChange(yearly ? "month" : "year")}>
        <i />
      </button>
      <button type="button" className="mk-billing__label" data-on={yearly} onClick={() => onChange("year")}>
        Annually
      </button>
      {saving ? <span className="mk-billing__save">Save up to {saving}%</span> : null}
    </div>
  );
}

export function Pricing({ tryHref }: { tryHref: string }) {
  const { auth, ready } = useStore();
  const [interval, setBilling] = useState<BillingInterval>("month");
  const signedIn = ready && auth.mode !== "signed-out";
  const billing = `/settings?section=subscription&interval=${interval}`;
  const paidHref = signedIn ? billing : `/login?mode=signup&next=${encodeURIComponent(billing)}`;

  return (
    <section className="mk-pricing" id="pricing" aria-labelledby="pricing-title">
      <div className="mk-shead mkf-rise">
        <p className="mk-eyebrow">
          <i /> Pricing
        </p>
        <h2 id="pricing-title" className="mkf-h2">
          Start free. <em>Upgrade when you travel more.</em>
        </h2>
        <p>Every plan includes the AI concierge. Prices in US dollars, plus applicable taxes. Cancel any time.</p>
      </div>
      <div className="mkf-rise">
        <BillingSwitch interval={interval} onChange={setBilling} saving={YEARLY_SAVING} />
      </div>
      <div className="mk-plans">
        {PLANS.map((p) => {
          const free = p.monthlyUSD === 0;
          const pick = p.id === "plus";
          const price = planPrice(p, interval);
          return (
            <article key={p.id} className="mk-plan mkf-rise" data-pick={pick} aria-labelledby={`plan-${p.id}`}>
              {pick && <span className="mk-plan__pick">Our pick</span>}
              <h3 id={`plan-${p.id}`}>{p.name}</h3>
              <p className="mk-plan__tag">{p.tagline}</p>
              <div className="mk-plan__cost">
                <p className="mk-plan__price" aria-live="polite">
                  <b key={`${p.id}-${interval}`}>{usd(price.perMonth)}</b>
                  <span>USD / month</span>
                </p>
                <p className="mk-plan__billed">
                  {free ? "Free forever" : interval === "year" ? `Billed ${usd(price.charged)} yearly` : "Billed monthly"}
                  {!free && interval === "year" && <s>{usd(p.monthlyUSD)}</s>}
                </p>
              </div>
              <Link href={free ? tryHref : paidHref} className={`mk-btn mk-btn--block ${pick ? "mk-btn--primary" : "mk-btn--ghost"}`} onClick={free ? carryDraft : undefined}>
                {free ? "Start free" : `Choose ${p.name}`}
                <ArrowRight />
              </Link>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <Check aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      <p className="mk-pricing__note mkf-rise">Plans and prices may change as Pyrius grows. We give at least 30 days&apos; notice before any increase, and you can cancel before it takes effect.</p>
    </section>
  );
}

/* ---------- Two ways to plan a trip ---------- */

const USUAL = [
  "Retype the same search for every new date",
  "Open a new tab for every option worth keeping",
  "Start over on another site for a hotel and a car",
  "Check back every day to see if the price moved",
];

const PYRIUS = [
  "Describe the trip in your own words",
  "Answer only what Pyrius still needs",
  "Compare flights side by side, in one place",
  "Save offers, follow their price, add a stay and a car",
];

export function Compare({ tryHref }: { tryHref: string }) {
  const [tabs, setTabs] = useState(7);
  return (
    <section className="mk-compare" id="compare" aria-labelledby="compare-title">
      <div className="mk-shead mkf-rise">
        <p className="mk-eyebrow">
          <i /> Choose your way
        </p>
        <h2 id="compare-title" className="mkf-h2">
          Two ways to plan <em>a trip.</em>
        </h2>
        <p>One of them involves a lot of tabs.</p>
      </div>

      <svg className="mk-compare__fork mkf-rise" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="mk-fork-l" x1="1" x2="0">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.55" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="mk-fork-r" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.5" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <path className="mk-compare__stem" d="M500,0 V54" pathLength={1} />
        <path className="mk-compare__left" d="M500,54 H222 V112" pathLength={1} stroke="url(#mk-fork-l)" />
        <path className="mk-compare__right" d="M500,54 H778 V112" pathLength={1} stroke="url(#mk-fork-r)" />
        <path className="mk-compare__tip--l" d="M213,103 L222,114 L231,103" pathLength={1} />
        <path className="mk-compare__tip--r" d="M769,103 L778,114 L787,103" pathLength={1} />
      </svg>

      <div className="mk-ways">
        <article className="mk-way mk-way--usual mkf-rise" aria-labelledby="way-usual">
          <span className="mk-way__label">The usual way</span>
          <h3 id="way-usual">Fill in the form. Again.</h3>
          <ul>
            {USUAL.map((t) => (
              <li key={t}>
                <X aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mk-way__foot">
            <span aria-live="polite">
              Tabs open: <b>{tabs}</b>
            </span>
            <button type="button" className="mk-btn mk-btn--sm mk-way__meh" onClick={() => setTabs((n) => n + 1)}>
              Open another tab
            </button>
          </div>
        </article>

        <span className="mk-ways__vs" aria-hidden="true">
          vs
        </span>

        <article className="mk-way mk-way--pyrius mkf-rise" aria-labelledby="way-pyrius">
          <span className="mk-way__label">
            <Orb size="sm" /> With Pyrius
          </span>
          <h3 id="way-pyrius">Say it once.</h3>
          <ul>
            {PYRIUS.map((t) => (
              <li key={t}>
                <Check aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mk-way__foot">
            <span>Free to start</span>
            <Link href={tryHref} className="mk-btn mk-btn--primary mk-btn--sm" onClick={carryDraft}>
              Try Pyrius
              <ArrowRight />
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */

/** An answer with its one linked phrase (in-page links glide with the smooth scroller). */
function Answer({ item }: { item: FaqItem }) {
  if (!item.link) return <>{item.a}</>;
  const [before, after] = item.a.split(item.link.text);
  const { href, text } = item.link;
  return (
    <>
      {before}
      {href.startsWith("#") ? (
        <a href={href} onClick={goto(href.slice(1))}>
          {text}
        </a>
      ) : (
        <Link href={href}>{text}</Link>
      )}
      {after}
    </>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  return (
    <section className="mk-faq" id="faq" aria-labelledby="faq-title">
      <div className="mk-shead mkf-rise">
        <p className="mk-eyebrow">
          <i /> FAQ
        </p>
        <h2 id="faq-title" className="mkf-h2">
          Questions, <em>answered.</em>
        </h2>
      </div>
      <div className="mk-faq__list mkf-rise">
        {FAQS.map((item, i) => {
          const on = open === i;
          return (
            <div key={item.q} className="mk-faq__item" data-open={on}>
              <h3>
                <button type="button" id={`${base}-q${i}`} aria-expanded={on} aria-controls={`${base}-a${i}`} onClick={() => setOpen(on ? null : i)}>
                  {item.q}
                  <ChevronDown aria-hidden="true" />
                </button>
              </h3>
              <div className="mk-faq__a" id={`${base}-a${i}`} role="region" aria-labelledby={`${base}-q${i}`}>
                <div>
                  <p>
                    <Answer item={item} />
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- Final call to action ---------- */

export function FinalCta({ draft, onDraft, onSubmit }: { draft: string; onDraft: (v: string) => void; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <section className="mkf-start" id="start" aria-labelledby="start-title">
      <div className="mkf-start__inner mkf-rise">
        <h2 id="start-title" className="mkf-start__title">
          Where to next? <em>Just say it.</em>
        </h2>
        <p>Create your free account, describe your first trip, and Pyrius takes it from there. Bookings happen with the airline or site you choose.</p>
        <form className="mkf-ask mkf-ask--end" onSubmit={onSubmit}>
          <label htmlFor="mk-trip-end" className="sr-only">
            Describe your trip
          </label>
          <input id="mk-trip-end" value={draft} onChange={(e) => onDraft(e.target.value)} placeholder="Describe your trip…" autoComplete="off" maxLength={300} />
          <button type="submit" className="mk-btn mk-btn--primary">
            <Sparkles />
            Try Pyrius
          </button>
        </form>
        <ul className="mkf-start__facts">
          <li>
            <Check /> Free plan
          </li>
          <li>
            <Check /> Book directly with providers
          </li>
          <li>
            <Check /> Your data stays yours
          </li>
        </ul>
      </div>
    </section>
  );
}
