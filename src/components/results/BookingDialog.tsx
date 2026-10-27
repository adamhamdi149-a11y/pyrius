"use client";
import { ArrowRight, Check, ExternalLink, Phone, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/primitives";
import { authHeaders } from "@/lib/authHeaders";
import { findAirport } from "@/lib/data/world";
import type { BookingChoice, BookingOption } from "@/lib/providers/serpapi";
import type { Currency, FlightOffer, FlightSegment } from "@/lib/types";
import { formatDate, formatDuration, formatTime, money, parseDate } from "@/lib/utils";

type Ready = { choices: BookingChoice[]; returnFlight?: FlightOffer; returns?: FlightOffer[]; changed?: boolean };
type Failure = { message: string; code?: string };
type BookRequest = NonNullable<BookingOption["request"]>;

const routeOf = (o: FlightOffer) => `${findAirport(o.outbound.from)?.city ?? o.outbound.from} → ${findAirport(o.outbound.to)?.city ?? o.outbound.to}`;
const isGoogleRedirect = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "www.google.com" && u.pathname.startsWith("/travel/clk");
  } catch {
    return false;
  }
};

/**
 * Opens the tab the seller's page will load in. It has to happen during the click itself (browsers block
 * tabs opened later), so it shows a short holding page while Pyrius finds the seller.
 */
export function openHoldingTab(title: string, note: string, wait = "This usually takes 10 to 20 seconds, then the seller's page opens here."): Window | null {
  const w = window.open("", "_blank");
  if (!w) return null;
  try {
    w.opener = null;
    const d = w.document;
    d.title = "Opening your booking · Pyrius";
    d.body.style.cssText = "margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c10;color:#ececf1;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif";
    const box = d.createElement("div");
    box.style.cssText = "text-align:center;padding:24px;max-width:420px";
    const style = d.createElement("style");
    style.textContent = "@keyframes s{to{transform:rotate(360deg)}}";
    const dot = d.createElement("div");
    dot.style.cssText = "width:34px;height:34px;margin:0 auto 18px;border-radius:50%;border:3px solid #2a2b33;border-top-color:#ff7628;animation:s .9s linear infinite";
    const h = d.createElement("p");
    h.style.cssText = "margin:0 0 6px;font-size:18px;font-weight:600";
    h.textContent = title;
    const p = d.createElement("p");
    p.style.cssText = "margin:0;color:#9899a6";
    p.textContent = note;
    const sub = d.createElement("p");
    sub.style.cssText = "margin:14px 0 0;font-size:13px;color:#6c6d79";
    sub.textContent = wait;
    box.append(style, dot, h, p, sub);
    d.body.append(box);
  } catch {
    // The tab still works as a target even if the holding page couldn't be drawn.
  }
  return w;
}

export const openBookingTab = (offer: FlightOffer) =>
  openHoldingTab(routeOf(offer), offer.returnPending ? "Finding the cheapest return flight and the best seller…" : "Finding the best seller for this flight…");

/** Google's booking redirect takes a form POST; it opens the seller's page for this exact itinerary. */
function sendToSeller(req: BookRequest, tab?: Window | null) {
  if (!isGoogleRedirect(req.url)) return false;
  const target = tab && !tab.closed ? tab : null;
  const doc = target ? target.document : document;
  const form = doc.createElement("form");
  form.method = "POST";
  form.action = req.url;
  if (!target) {
    form.target = "_blank";
    form.rel = "noopener noreferrer";
  }
  for (const [k, v] of req.fields) {
    const input = doc.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = v;
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  form.submit();
  if (!target) form.remove();
  return true;
}

const oneSeller = (c?: BookingChoice) => (c && c.tickets.length === 1 && c.tickets[0].request ? c.tickets[0] : null);

/**
 * Booking for a live offer happens with the seller (airline or travel site). For a round trip Pyrius adds
 * the cheapest return flight (the price on the card), finds who sells the whole trip, and sends the user
 * to the cheapest seller's booking page with this itinerary. Pyrius never books or takes payment.
 */
export function BookingDialog({ offer, open, onClose, onExpired, tab }: { offer: FlightOffer; open: boolean; onClose: () => void; onExpired?: () => void; tab?: Window | null }) {
  const [ready, setReady] = useState<Ready | null>(null);
  const [loading, setLoading] = useState(false);
  const [fail, setFail] = useState<Failure | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const started = useRef(false);
  const pending = useRef<Window | null>(null);
  const ref = offer.booking;

  const closeTab = () => {
    if (pending.current && !pending.current.closed) pending.current.close();
    pending.current = null;
  };

  const lookup = useCallback(
    async (step: "trip" | "options", token: string, extra?: Partial<Ready>) => {
      if (!ref) return;
      setLoading(true);
      setFail(null);
      setSentTo(null);
      setRetry(() => () => lookup(step, token, extra));
      try {
        const res = await fetch("/api/flights/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ step, token, params: ref.params }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(body.error || "The booking options couldn't be loaded."), { code: body.code });
        const next: Ready = { choices: body.choices ?? [], returnFlight: body.returnFlight, returns: body.returns, ...extra };
        setReady(next);
        // One seller sells the whole trip at the lowest price: continue straight to them.
        const seller = oneSeller(next.choices[0]);
        if (seller && pending.current && sendToSeller(seller.request!, pending.current)) setSentTo(seller.seller);
        else closeTab();
        pending.current = null;
      } catch (err) {
        closeTab();
        setFail({ message: (err as Error).message, code: (err as { code?: string }).code });
      } finally {
        setLoading(false);
      }
    },
    [ref],
  );

  useEffect(() => {
    if (!open || !ref || started.current) return;
    started.current = true;
    pending.current = tab ?? null;
    if (offer.returnPending && ref.departureToken) lookup("trip", ref.departureToken);
    else if (ref.bookingToken) lookup("options", ref.bookingToken);
    else {
      closeTab();
      setFail({ message: "This offer can't be booked from Pyrius. Search again for current options.", code: "expired" });
    }
  }, [open, ref, tab, offer.returnPending, lookup]);

  useEffect(() => {
    if (open) return;
    closeTab();
    started.current = false;
    setReady(null);
    setFail(null);
    setSentTo(null);
    setPicking(false);
  }, [open]);

  const chooseReturn = (r: FlightOffer) => {
    if (!r.booking?.bookingToken) return;
    setPicking(false);
    pending.current = openBookingTab(offer);
    lookup("options", r.booking.bookingToken, { returnFlight: r, returns: ready?.returns, changed: true });
  };

  const best = ready?.choices[0];
  const single = oneSeller(best);
  const split = best && best.tickets.length > 1 ? best : undefined;
  const singleAlt = split ? ready?.choices.find((c) => oneSeller(c)) : undefined;
  const others = ready ? ready.choices.slice(1).filter((c) => c !== singleAlt) : [];
  // Search and seller prices are each rounded, so a dollar either way isn't a change.
  const priceMoved = Boolean(ready && !ready.changed && best?.total !== undefined && Math.abs(best.total - offer.totalPrice) > Math.max(2, offer.totalPrice * 0.01));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Book ${routeOf(offer)}`}
      description={sentTo ? `${sentTo}'s booking page opened in a new tab with this trip.` : "Pyrius picks the lowest price and the seller. You finish on their site."}
    >
      <div className="bk">
        {loading && (
          <div className="bk__loading" role="status" aria-live="polite">
            <p className="bk__status">{offer.returnPending && !ready?.changed ? "Finding the cheapest return flight and the best seller…" : "Finding the best seller…"}</p>
            {[0, 1].map((i) => (
              <Skeleton key={i} h={58} r={12} />
            ))}
          </div>
        )}

        {!loading && fail && (
          <div className="bk__fail" role="alert">
            <p>{fail.message}</p>
            {fail.code === "expired" ? (
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  onClose();
                  onExpired?.();
                }}
              >
                <RotateCcw />
                Search again
              </button>
            ) : (
              retry && (
                <button className="btn btn--secondary btn--sm" onClick={retry}>
                  <RotateCcw />
                  Try again
                </button>
              )
            )}
          </div>
        )}

        {!loading && !fail && ready && (
          <>
            <div className="bk__trip">
              <LegLine label="Outbound" seg={offer.outbound} airline={offer.airline.name} />
              {ready.returnFlight && (
                <LegLine
                  label="Return"
                  seg={ready.returnFlight.outbound}
                  airline={ready.returnFlight.airline.name}
                  action={ready.returns && ready.returns.length > 1 ? { label: picking ? "Keep this one" : "Change", onClick: () => setPicking((x) => !x) } : undefined}
                />
              )}
            </div>

            {picking && ready.returns ? (
              <ul className="bk__list" aria-label="Return flights">
                {ready.returns.map((r) => (
                  <li key={r.id}>
                    <button className="bk__row" onClick={() => chooseReturn(r)} disabled={!r.booking?.bookingToken} aria-current={r.id === ready.returnFlight?.id}>
                      <span className="bk__main">
                        <b>
                          {formatTime(r.outbound.depart)} → {formatTime(r.outbound.arrive)}
                          {r.id === ready.returnFlight?.id && <Check className="bk__tick" aria-label="Selected" />}
                        </b>
                        <span>
                          {r.airline.name} · {r.outbound.flightNumber} · {formatDuration(r.outbound.durationMin)} · {stopsText(r.outbound)}
                        </span>
                      </span>
                      <span className="bk__price">
                        <b>{money(r.totalPrice, r.currency)}</b>
                        <span>round trip</span>
                      </span>
                      <ArrowRight />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                {priceMoved && (
                  <p className="bk__note bk__note--warn">
                    Google Flights now shows {money(best!.total!, best!.currency as Currency)} for this trip ({money(offer.totalPrice, offer.currency)} when you searched). Prices change until you book.
                  </p>
                )}

                {single && (
                  <div className="bk__best">
                    <p className="bk__label">
                      {sentTo ? (
                        <>
                          <Check /> Opened in a new tab
                        </>
                      ) : (
                        "Lowest price for this trip"
                      )}
                    </p>
                    <TicketRow t={single} primary cta={sentTo ? "Open again" : `Continue to ${single.seller}`} />
                  </div>
                )}

                {split && (
                  <div className="bk__best">
                    <p className="bk__label">Lowest price: {money(split.total ?? 0, split.currency as Currency)} as two separate tickets</p>
                    <p className="bk__note">
                      This price combines an outbound ticket and a return ticket from different sellers, so book both. Each ticket has its own rules: if one flight changes, the other seller
                      doesn&apos;t have to rebook you.
                    </p>
                    {split.tickets.map((t, i) => (
                      <TicketRow key={i} t={t} primary cta={`Book ${t.leg === "returning" ? "return" : "outbound"}`} />
                    ))}
                    {singleAlt && (
                      <>
                        <p className="bk__label">Or one ticket for the whole trip</p>
                        <TicketRow t={singleAlt.tickets[0]} cta="Continue" />
                      </>
                    )}
                  </div>
                )}

                {others.length > 0 && (
                  <details className="bk__more">
                    <summary>Other sellers ({others.length})</summary>
                    <ul className="bk__list" aria-label="Other sellers">
                      {others.map((c, i) => (
                        <li key={i} className="bk__group">
                          {c.tickets.map((t, j) => (
                            <TicketRow key={j} t={t} cta="Continue" />
                          ))}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </>
        )}

        <p className="bk__fine">
          Prices and availability come from Google Flights and are confirmed by the seller before you pay. Check that the flights on the seller&apos;s page match the ones above. Pyrius
          doesn&apos;t sell tickets or take payment; the booking is between you and the seller.
        </p>
      </div>
    </Dialog>
  );
}

function stopsText(s: FlightSegment) {
  return s.stops ? `${s.stops} stop${s.stops > 1 ? "s" : ""} (${s.stopCodes.join(", ")})` : "Nonstop";
}

function LegLine({ label, seg, airline, action }: { label: string; seg: FlightSegment; airline: string; action?: { label: string; onClick: () => void } }) {
  const days = Math.round((parseDate(seg.arrive.slice(0, 10)).getTime() - parseDate(seg.depart.slice(0, 10)).getTime()) / 86400000);
  return (
    <div className="bk__leg">
      <span className="bk__leg-k">
        {label} · {formatDate(seg.depart.slice(0, 10), "en", { weekday: "short", month: "short", day: "numeric" })}
      </span>
      <b className="num">
        {formatTime(seg.depart)} {seg.from} → {formatTime(seg.arrive)}
        {days > 0 && <sup>+{days}</sup>} {seg.to}
      </b>
      <span>
        {airline} · {seg.flightNumber} · {formatDuration(seg.durationMin)} · {stopsText(seg)}
      </span>
      {action && (
        <button type="button" className="bk__change" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

function TicketRow({ t, cta, primary }: { t: BookingOption; cta: string; primary?: boolean }) {
  return (
    <div className="bk__opt">
      <span className="bk__main">
        <b>
          {t.seller}
          {t.isAirline && <span className="badge">Airline</span>}
          {t.leg && <span className="badge">{t.leg === "departing" ? "Outbound ticket" : "Return ticket"}</span>}
        </b>
        <span>{[t.fareName, ...t.details.slice(0, 2)].filter(Boolean).join(" · ")}</span>
      </span>
      <span className="bk__price">{t.price !== undefined && <b>{money(t.price, t.currency as Currency)}</b>}</span>
      {t.request ? (
        <button className={primary ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"} onClick={() => sendToSeller(t.request!)}>
          {cta}
          <ExternalLink />
        </button>
      ) : t.phone ? (
        <a className="btn btn--secondary btn--sm" href={`tel:${t.phone.replace(/[^\d+]/g, "")}`}>
          <Phone />
          {t.phone}
        </a>
      ) : null}
    </div>
  );
}
