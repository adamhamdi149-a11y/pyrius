"use client";
import { ArrowRight, ExternalLink, Phone, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/primitives";
import { authHeaders } from "@/lib/authHeaders";
import { airportByCode } from "@/lib/data/catalog";
import type { BookingOption } from "@/lib/providers/serpapi";
import type { Currency, FlightOffer } from "@/lib/types";
import { formatDuration, formatTime, money } from "@/lib/utils";

type Step = { kind: "returns"; offers: FlightOffer[] } | { kind: "options"; options: BookingOption[]; via?: FlightOffer };
type Failure = { message: string; code?: string };

/**
 * Booking for a live offer happens with the seller (airline or travel site). This finds who sells
 * the exact itinerary, then continues to their booking page through Google's booking redirect.
 * Pyrius never books or takes payment.
 */
export function BookingDialog({ offer, open, onClose, onExpired }: { offer: FlightOffer; open: boolean; onClose: () => void; onExpired?: () => void }) {
  const [step, setStep] = useState<Step | null>(null);
  const [loading, setLoading] = useState(false);
  const [fail, setFail] = useState<Failure | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const ref = offer.booking;
  const route = `${airportByCode(offer.outbound.from)?.city ?? offer.outbound.from} → ${airportByCode(offer.outbound.to)?.city ?? offer.outbound.to}`;

  const ask = useCallback(
    async (kind: "returns" | "options", token: string, via?: FlightOffer) => {
      if (!ref) return;
      setLoading(true);
      setFail(null);
      setRetry(() => () => ask(kind, token, via));
      try {
        const res = await fetch("/api/flights/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ step: kind, token, params: ref.params }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw Object.assign(new Error(body.error || "The booking options couldn't be loaded."), { code: body.code });
        setStep(kind === "returns" ? { kind, offers: body.offers ?? [] } : { kind, options: body.options ?? [], via });
      } catch (err) {
        setFail({ message: (err as Error).message, code: (err as { code?: string }).code });
      } finally {
        setLoading(false);
      }
    },
    [ref],
  );

  useEffect(() => {
    if (!open || !ref || step || loading || fail) return;
    if (offer.returnPending && ref.departureToken) ask("returns", ref.departureToken);
    else if (ref.bookingToken) ask("options", ref.bookingToken);
    else setFail({ message: "This offer can't be booked from Pyrius. Search again for current options.", code: "expired" });
  }, [open, ref, step, loading, fail, offer.returnPending, ask]);

  useEffect(() => {
    if (open) return;
    setStep(null);
    setFail(null);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Book ${route}`}
      description={offer.returnPending && step?.kind !== "options" ? "Choose your return flight, then pick who to book with." : "Pick who to book with. You'll finish on their site."}
    >
      <div className="bk">
        {loading && (
          <div className="bk__loading" role="status" aria-live="polite">
            <span className="sr-only">Loading booking options</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={54} r={12} />
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

        {!loading && !fail && step?.kind === "returns" && (
          <ul className="bk__list" aria-label="Return flights">
            {step.offers.map((r) => (
              <li key={r.id}>
                <button className="bk__row" onClick={() => r.booking?.bookingToken && ask("options", r.booking.bookingToken, r)} disabled={!r.booking?.bookingToken}>
                  <span className="bk__main">
                    <b>
                      {formatTime(r.outbound.depart)} → {formatTime(r.outbound.arrive)}
                    </b>
                    <span>
                      {r.airline.name} · {r.outbound.flightNumber} · {formatDuration(r.outbound.durationMin)} ·{" "}
                      {r.outbound.stops ? `${r.outbound.stops} stop${r.outbound.stops > 1 ? "s" : ""} (${r.outbound.stopCodes.join(", ")})` : "Nonstop"}
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
        )}

        {!loading && !fail && step?.kind === "options" && (
          <>
            {step.options.some((o) => o.leg) && <p className="bk__note">These flights are sold as separate tickets: book the outbound and return tickets with each seller.</p>}
            <ul className="bk__list" aria-label="Where to book">
              {step.options.map((o, i) => (
                <li key={`${o.seller}-${o.leg ?? ""}-${i}`} className="bk__opt">
                  <span className="bk__main">
                    <b>
                      {o.seller}
                      {o.isAirline && <span className="badge">Airline</span>}
                      {o.leg && <span className="badge">{o.leg === "departing" ? "Outbound ticket" : "Return ticket"}</span>}
                    </b>
                    <span>{[o.fareName, ...o.details.slice(0, 2)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="bk__price">{o.price !== undefined && <b>{money(o.price, o.currency as Currency)}</b>}</span>
                  {o.request ? (
                    <button className="btn btn--primary btn--sm" onClick={() => continueToSeller(o.request!)}>
                      Continue
                      <ExternalLink />
                    </button>
                  ) : o.phone ? (
                    <a className="btn btn--secondary btn--sm" href={`tel:${o.phone.replace(/[^\d+]/g, "")}`}>
                      <Phone />
                      {o.phone}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="bk__fine">
          Prices and availability come from Google Flights and are confirmed by the seller before you pay. Pyrius doesn&apos;t sell tickets or take payment; the booking is between you and
          the seller.
        </p>
      </div>
    </Dialog>
  );
}

/** Google's booking redirect takes a form POST; it opens the seller's page for this itinerary in a new tab. */
function continueToSeller(req: { url: string; fields: [string, string][] }) {
  const u = new URL(req.url);
  if (u.protocol !== "https:" || u.hostname !== "www.google.com" || !u.pathname.startsWith("/travel/clk")) return;
  const form = document.createElement("form");
  form.method = "POST";
  form.action = u.toString();
  form.target = "_blank";
  form.rel = "noopener noreferrer";
  for (const [k, v] of req.fields) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = v;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
  form.remove();
}
