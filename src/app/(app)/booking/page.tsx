"use client";
import { CheckCircle2, CircleAlert, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/primitives";
import type { FinishResult } from "@/lib/booking/flightCheckout";
import { formatDate, formatTime } from "@/lib/utils";

const price = (amount: number, currency: string) => new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);

/** Where Stripe Checkout returns after payment: the flight is booked (once) and the confirmation shown. */
export default function BookingPage() {
  return (
    <div className="main__scroll">
      <div className="page bconf-page">
        <Suspense fallback={<Skeleton h={200} r={16} />}>
          <Confirmation />
        </Suspense>
      </div>
    </div>
  );
}

function Confirmation() {
  const id = useSearchParams().get("session_id");
  const [result, setResult] = useState<FinishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const finish = useCallback(async () => {
    if (!id) return;
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/flights/duffel/finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && body.status !== "not_found") throw new Error(body.error || "This booking couldn't be checked right now.");
      setResult(body);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    finish();
  }, [finish]);

  if (!id || result?.status === "not_found") {
    return <Notice icon={<CircleAlert />} title="Booking not found" text="This link doesn't match a Pyrius booking." />;
  }
  if (error) {
    return (
      <Notice icon={<CircleAlert />} title="Still checking your booking" text={error}>
        <button className="btn btn--secondary" onClick={finish}>
          <RotateCcw /> Check again
        </button>
      </Notice>
    );
  }
  if (!result) {
    return (
      <div className="bconf" role="status" aria-live="polite">
        <h1 className="t-title">Booking your flight…</h1>
        <p className="page__sub">Your payment went through. Pyrius is confirming the seats with the airline; this takes a few seconds. Please keep this page open.</p>
        <Skeleton h={160} r={16} />
      </div>
    );
  }
  if (result.status === "unpaid") {
    return (
      <Notice icon={<CircleAlert />} title="Payment not completed" text="Nothing was booked and you haven't been charged.">
        <Link className="btn btn--primary" href="/app">
          Back to Pyrius
        </Link>
      </Notice>
    );
  }
  if (result.status === "failed") {
    return (
      <Notice
        icon={<CircleAlert />}
        title="The airline didn't confirm this booking"
        text={`${result.message} ${result.refunded ? "Your payment has been refunded in full; it can take 5 to 10 business days to show on your statement." : "Your refund didn't go through automatically; Pyrius support will refund you."}`}
      >
        <Link className="btn btn--primary" href="/app">
          Find other flights
        </Link>
      </Notice>
    );
  }

  const o = result.order;
  return (
    <div className="bconf">
      <div className="bconf__head">
        <CheckCircle2 className="bconf__ok" aria-hidden="true" />
        <div>
          <h1 className="t-title">You&apos;re booked</h1>
          <p className="page__sub">
            {o.airline} · {o.passengers.join(", ")}
          </p>
        </div>
      </div>
      {o.testMode && <p className="bk__note bk__note--warn">Test booking: made in Duffel&apos;s test environment with a Stripe test payment. No real ticket was issued and no money was taken.</p>}
      <div className="bconf__ref">
        <span className="t-eyebrow">Airline booking reference</span>
        <b className="num">{o.reference}</b>
        <span className="field__hint">Use it to check in and to manage the booking on {o.airline}&apos;s website.</span>
      </div>
      <div className="bk__trip">
        {o.slices.map((s, i) => (
          <div className="bk__leg" key={i}>
            <span className="bk__leg-k">
              {i === 0 ? "Outbound" : "Return"} · {formatDate(s.depart.slice(0, 10), "en", { weekday: "short", month: "short", day: "numeric" })}
            </span>
            <b className="num">
              {formatTime(s.depart)} {s.from} → {formatTime(s.arrive)} {s.to}
            </b>
            <span>{s.flights}</span>
          </div>
        ))}
      </div>
      <p className="bconf__total">
        Paid <b className="num">{price(o.total, o.currency)}</b> · Stripe emails the receipt.
      </p>
      <Link className="btn btn--primary" href="/app">
        Back to Pyrius
      </Link>
    </div>
  );
}

function Notice({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="bconf bconf--notice">
      <div className="bconf__head">
        <span className="bconf__warn">{icon}</span>
        <h1 className="t-title">{title}</h1>
      </div>
      <p className="page__sub">{text}</p>
      {children}
    </div>
  );
}
