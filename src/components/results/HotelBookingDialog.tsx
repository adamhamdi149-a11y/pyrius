"use client";
import { BadgeCheck, Check, ExternalLink, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/primitives";
import { authHeaders } from "@/lib/authHeaders";
import type { HotelSeller } from "@/lib/providers/serpapiHotels";
import type { Currency, HotelOffer } from "@/lib/types";
import { formatRange, money } from "@/lib/utils";
import { openHoldingTab } from "./BookingDialog";

type Failure = { message: string; code?: string };

const isGoogleLink = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "www.google.com";
  } catch {
    return false;
  }
};

export const openHotelTab = (h: HotelOffer) => openHoldingTab(h.name, "Finding the site with the lowest price for your dates…", "This usually takes a few seconds, then the booking page opens here.");

function goTo(url: string, tab?: Window | null) {
  if (!isGoogleLink(url)) return false;
  if (tab && !tab.closed) tab.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

/**
 * Booking for a live stay happens with the seller (the hotel itself or a travel site). Pyrius finds
 * who sells the room for these dates and sends the user to the cheapest one. It never books or takes payment.
 */
export function HotelBookingDialog({ offer, open, onClose, tab }: { offer: HotelOffer; open: boolean; onClose: () => void; tab?: Window | null }) {
  const [sellers, setSellers] = useState<HotelSeller[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fail, setFail] = useState<Failure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const started = useRef(false);
  const pending = useRef<Window | null>(null);

  const closeTab = () => {
    if (pending.current && !pending.current.closed) pending.current.close();
    pending.current = null;
  };

  const lookup = useCallback(async () => {
    if (!offer.propertyToken || !offer.params) return;
    setLoading(true);
    setFail(null);
    try {
      const res = await fetch("/api/hotels/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ token: offer.propertyToken, params: offer.params }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.error || "The booking options couldn't be loaded."), { code: body.code });
      const list: HotelSeller[] = body.sellers ?? [];
      setSellers(list);
      if (list[0] && pending.current && goTo(list[0].url, pending.current)) setSentTo(list[0].name);
      else closeTab();
      pending.current = null;
    } catch (err) {
      closeTab();
      setFail({ message: (err as Error).message, code: (err as { code?: string }).code });
    } finally {
      setLoading(false);
    }
  }, [offer.propertyToken, offer.params]);

  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;
    pending.current = tab ?? null;
    lookup();
  }, [open, tab, lookup]);

  useEffect(() => {
    if (open) return;
    closeTab();
    started.current = false;
    setSellers(null);
    setFail(null);
    setSentTo(null);
  }, [open]);

  const best = sellers?.[0];
  const others = sellers?.slice(1) ?? [];
  const moved = best?.total !== undefined && Math.abs(best.total - offer.totalPrice) > Math.max(2, offer.totalPrice * 0.01);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Book ${offer.name}`}
      description={sentTo ? `${sentTo}'s booking page opened in a new tab for these dates.` : "Pyrius picks the site with the lowest price. You finish on their site."}
    >
      <div className="bk">
        <div className="bk__trip">
          <div className="bk__leg">
            <span className="bk__leg-k">
              {offer.city} · {offer.nights} night{offer.nights > 1 ? "s" : ""} · {offer.guests} guest{offer.guests > 1 ? "s" : ""}
            </span>
            <b>{formatRange(offer.checkIn, offer.checkOut)}</b>
            {offer.address && <span>{offer.address}</span>}
          </div>
        </div>

        {loading && (
          <div className="bk__loading" role="status" aria-live="polite">
            <p className="bk__status">Finding the site with the lowest price for your dates…</p>
            {[0, 1].map((i) => (
              <Skeleton key={i} h={58} r={12} />
            ))}
          </div>
        )}

        {!loading && fail && (
          <div className="bk__fail" role="alert">
            <p>{fail.message}</p>
            {fail.code !== "expired" && (
              <button className="btn btn--secondary btn--sm" onClick={lookup}>
                <RotateCcw />
                Try again
              </button>
            )}
          </div>
        )}

        {!loading && !fail && best && (
          <>
            {moved && (
              <p className="bk__note bk__note--warn">
                Google Hotels now shows {money(best.total!, best.currency as Currency)} for these dates ({money(offer.totalPrice, offer.currency)} when you searched). Prices change until you book.
              </p>
            )}
            <div className="bk__best">
              <p className="bk__label">
                {sentTo ? (
                  <>
                    <Check /> Opened in a new tab
                  </>
                ) : (
                  "Lowest price for your dates"
                )}
              </p>
              <SellerRow s={best} primary cta={sentTo ? "Open again" : `Continue to ${best.name}`} />
            </div>
            {others.length > 0 && (
              <details className="bk__more">
                <summary>Other sites ({others.length})</summary>
                <ul className="bk__list" aria-label="Other sites">
                  {others.map((s) => (
                    <li key={s.name}>
                      <SellerRow s={s} cta="Continue" />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        <p className="bk__fine">
          Prices come from Google Hotels for the whole stay, taxes and fees included where the site reports them, and are confirmed by the site before you pay. Check the room and the
          cancellation rules on their page. Pyrius doesn&apos;t sell rooms or take payment; the booking is between you and the site.
        </p>
      </div>
    </Dialog>
  );
}

function SellerRow({ s, cta, primary }: { s: HotelSeller; cta: string; primary?: boolean }) {
  return (
    <div className="bk__opt">
      <span className="bk__main">
        <b>
          {s.name}
          {s.official && (
            <span className="badge">
              <BadgeCheck style={{ width: 12, height: 12 }} />
              Official site
            </span>
          )}
        </b>
        <span>
          {[s.pricePerNight !== undefined ? `${money(s.pricePerNight, s.currency as Currency)} / night` : null, s.freeCancellation ? "Free cancellation" : null].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="bk__price">
        {s.total !== undefined && <b>{money(s.total, s.currency as Currency)}</b>}
        <span>total</span>
      </span>
      <button className={primary ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"} onClick={() => goTo(s.url)}>
        {cta}
        <ExternalLink />
      </button>
    </div>
  );
}
