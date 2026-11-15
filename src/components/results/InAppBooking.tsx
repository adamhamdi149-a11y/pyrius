"use client";
import { ArrowLeft, ArrowRight, Briefcase, Lock, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { authHeaders } from "@/lib/authHeaders";
import type { DuffelFare } from "@/lib/providers/duffel";
import type { FlightOffer, FlightSearchParams, FlightSegment } from "@/lib/types";
import { formatDate, formatDuration, formatTime } from "@/lib/utils";

type Kind = "adult" | "child" | "infant";
type Person = { title: string; gender: string; givenName: string; familyName: string; bornOn: string };
const EMPTY: Person = { title: "", gender: "", givenName: "", familyName: "", bornOn: "" };
const KIND_LABEL: Record<Kind, string> = { adult: "Adult", child: "Child", infant: "Lap infant" };

const price = (amount: number, currency: string) => new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
const flightNumbers = (s?: FlightSegment) => (s ? (s.legs?.length ? s.legs.map((l) => l.flightNumber) : s.flightNumber.split(/,\s*/)).map((n) => n.replace(/\s/g, "")) : undefined);
const kindsOf = (p: FlightSearchParams): Kind[] => [...Array<Kind>(p.adults).fill("adult"), ...Array<Kind>(p.children).fill("child"), ...Array<Kind>(p.infants ?? 0).fill("infant")];
const stops = (s: FlightSegment) => (s.stops ? `${s.stops} stop${s.stops > 1 ? "s" : ""} (${s.stopCodes.join(", ")})` : "Nonstop");

/**
 * Flights Pyrius sells itself (Duffel), paid by card on Stripe's checkout page. The user picks a
 * fare, enters each traveller as on their passport, and pays; the booking is made right after payment.
 */
export function InAppBooking({ offer, params, mode }: { offer: FlightOffer; params: FlightSearchParams; mode: "test" | "live" }) {
  const [fares, setFares] = useState<DuffelFare[] | null>(null);
  const [exact, setExact] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<DuffelFare | null>(null);
  const started = useRef(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/flights/duffel/fares", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ params, outbound: flightNumbers(offer.outbound), inbound: flightNumbers(offer.inbound), airline: offer.airline.code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Fares couldn't be loaded.");
      setFares(body.fares ?? []);
      setExact(Boolean(body.exact));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="ib" aria-label="Book in Pyrius">
      <p className="bk__label">
        Book in Pyrius
        {mode === "test" && <span className="badge badge--warning">Test mode</span>}
      </p>

      {chosen ? (
        <TravellerForm fare={chosen} params={params} mode={mode} onBack={() => setChosen(null)} onFare={setChosen} />
      ) : loading ? (
        <div className="bk__loading" role="status" aria-live="polite">
          <p className="bk__status">Checking fares Pyrius can book…</p>
          <Skeleton h={64} r={12} />
          <Skeleton h={64} r={12} />
        </div>
      ) : error ? (
        <div className="bk__fail" role="alert">
          <p>{error}</p>
          <button className="btn btn--secondary btn--sm" onClick={load}>
            <RotateCcw />
            Try again
          </button>
        </div>
      ) : !fares?.length ? (
        <p className="bk__note">Pyrius can&apos;t sell any flights on this route and date yet. Book with a seller below.</p>
      ) : (
        <>
          {!exact && <p className="bk__note">Pyrius can&apos;t sell the exact flights on this card. These are the lowest fares on the same route and dates that it can book for you.</p>}
          <ul className="bk__list" aria-label="Fares Pyrius can book">
            {fares.map((f, i) => (
              <li key={f.id}>
                <button className="bk__row ib__fare" onClick={() => setChosen(f)}>
                  <span className="bk__main">
                    <b>
                      {f.airline.name}
                      {f.fareBrand && <span className="ib__muted">{f.fareBrand}</span>}
                      {exact && i === 0 && <span className="badge">Same flights</span>}
                    </b>
                    {f.slices.map((s, j) => (
                      <span key={j} className="num">
                        {formatTime(s.depart)} {s.from} → {formatTime(s.arrive)} {s.to} · {s.flightNumber} · {formatDuration(s.durationMin)} · {stops(s)}
                      </span>
                    ))}
                    <span>
                      {f.cabin} · {f.baggage.checked ? `${f.baggage.checked} checked bag${f.baggage.checked > 1 ? "s" : ""}` : "No checked bag"} · {f.refund}
                    </span>
                  </span>
                  <span className="bk__price">
                    <b>{price(f.total, f.currency)}</b>
                    <span>total</span>
                  </span>
                  <ArrowRight />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function TravellerForm({ fare, params, mode, onBack, onFare }: { fare: DuffelFare; params: FlightSearchParams; mode: "test" | "live"; onBack: () => void; onFare: (f: DuffelFare) => void }) {
  const kinds = kindsOf(params);
  const [people, setPeople] = useState<Person[]>(() => kinds.map(() => ({ ...EMPTY })));
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; traveller?: number } | null>(null);
  const [moved, setMoved] = useState<{ from: number } | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const set = (i: number, k: keyof Person, v: string) => setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/flights/duffel/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ params, fareKey: fare.key, shownTotal: fare.total, offerId: moved ? fare.id : undefined, travellers: people.map((p) => ({ ...p, email, phone })) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.error || "The payment page couldn't open."), { traveller: body.traveller });
      if (body.priceChanged) {
        setMoved({ from: fare.total });
        onFare(body.priceChanged);
        setBusy(false);
        return;
      }
      window.location.assign(body.url);
    } catch (err) {
      setError({ message: (err as Error).message, traveller: (err as { traveller?: number }).traveller });
      setBusy(false);
    }
  };

  return (
    <form className="ib__form" onSubmit={submit} noValidate={false}>
      <div className="bk__trip">
        {fare.slices.map((s, i) => (
          <div className="bk__leg" key={i}>
            <span className="bk__leg-k">
              {i === 0 ? "Outbound" : "Return"} · {formatDate(s.depart.slice(0, 10), "en", { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <b className="num">
              {formatTime(s.depart)} {s.from} → {formatTime(s.arrive)} {s.to}
            </b>
            <span>
              {fare.airline.name} · {s.flightNumber} · {formatDuration(s.durationMin)} · {stops(s)}
            </span>
          </div>
        ))}
        <button type="button" className="bk__change" onClick={onBack}>
          <ArrowLeft /> Other fares
        </button>
      </div>

      <p className="ib__facts">
        <Briefcase /> {fare.cabin}
        {fare.fareBrand ? ` (${fare.fareBrand})` : ""} · {fare.baggage.carryOn ? "Carry-on" : "No carry-on"} · {fare.baggage.checked ? `${fare.baggage.checked} checked bag${fare.baggage.checked > 1 ? "s" : ""}` : "No checked bag"} · {fare.refund} · {fare.change}
      </p>

      {kinds.map((k, i) => (
        <fieldset key={i} className={error?.traveller === i ? "ib__person ib__person--bad" : "ib__person"}>
          <legend>
            Traveller {i + 1} · {KIND_LABEL[k]}
          </legend>
          <div className="ib__grid">
            <label className="field ib__narrow">
              <span className="field__label">Title</span>
              <select className="select" required value={people[i].title} onChange={(e) => set(i, "title", e.target.value)}>
                <option value="" disabled>
                  Choose
                </option>
                {k === "adult" ? (
                  <>
                    <option value="mr">Mr</option>
                    <option value="ms">Ms</option>
                    <option value="mrs">Mrs</option>
                    <option value="dr">Dr</option>
                  </>
                ) : (
                  <>
                    <option value="mr">Mstr / Mr</option>
                    <option value="miss">Miss</option>
                  </>
                )}
              </select>
            </label>
            <label className="field ib__narrow">
              <span className="field__label">Gender on passport</span>
              <select className="select" required value={people[i].gender} onChange={(e) => set(i, "gender", e.target.value)}>
                <option value="" disabled>
                  Choose
                </option>
                <option value="f">Female</option>
                <option value="m">Male</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">First name</span>
              <input className="input" required autoComplete={i === 0 ? "given-name" : "off"} maxLength={40} value={people[i].givenName} onChange={(e) => set(i, "givenName", e.target.value)} />
            </label>
            <label className="field">
              <span className="field__label">Last name</span>
              <input className="input" required autoComplete={i === 0 ? "family-name" : "off"} maxLength={40} value={people[i].familyName} onChange={(e) => set(i, "familyName", e.target.value)} />
            </label>
            <label className="field">
              <span className="field__label">Date of birth</span>
              <input className="input num" type="date" required max={today} min="1900-01-01" autoComplete={i === 0 ? "bday" : "off"} value={people[i].bornOn} onChange={(e) => set(i, "bornOn", e.target.value)} />
            </label>
          </div>
        </fieldset>
      ))}

      <fieldset className="ib__person">
        <legend>Contact for this booking</legend>
        <div className="ib__grid">
          <label className="field">
            <span className="field__label">Email</span>
            <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Phone, with country code</span>
            <input className="input num" type="tel" required autoComplete="tel" placeholder="+1 514 555 0123" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        </div>
        <span className="field__hint">The airline uses these for schedule changes. Names must match each passport exactly.</span>
      </fieldset>

      {error && (
        <p className="bk__fail" role="alert">
          {error.message}
        </p>
      )}

      {moved && (
        <p className="bk__note bk__note--warn" role="status">
          The airline&apos;s price for these flights is now {price(fare.total, fare.currency)} ({price(moved.from, fare.currency)} before). Continue to pay the new price, or pick another fare.
        </p>
      )}

      <button className="btn btn--primary ib__pay" type="submit" disabled={busy}>
        {busy ? (
          "Confirming the price…"
        ) : (
          <>
            <Lock />
            Continue to payment · {price(fare.total, fare.currency)}
          </>
        )}
      </button>
      <p className="bk__fine">
        {mode === "test" ? (
          <>
            <b>Test mode:</b> pay with Stripe&apos;s test card 4242 4242 4242 4242 (any future date, any CVC). No money is taken and no real ticket is issued.{" "}
          </>
        ) : null}
        You pay on Stripe&apos;s secure page; Pyrius never sees your card. The booking is made with the airline right after payment. If the airline can&apos;t confirm it, you&apos;re refunded in
        full.
      </p>
    </form>
  );
}
