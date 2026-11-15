import { createOrder, DuffelError, type DuffelFare, getOffer, getOrder, orderSummary, type OrderSummary, quote, type Traveller } from "@/lib/providers/duffel";
import { stripe } from "@/lib/stripe";
import type { FlightSearchParams } from "@/lib/types";

/**
 * Selling a Duffel fare inside Pyrius:
 *  1. start: price the fare again with the travellers' real ages; if the price moved, the user confirms it first.
 *  2. Stripe Checkout takes the card payment (Pyrius never sees the card).
 *  3. finish: once Stripe says it's paid, create the Duffel order, paid from the Pyrius Duffel balance.
 *     If the airline refuses it (sold out, price changed), the payment is refunded in full.
 * The booking is recorded on the Stripe payment (metadata), so finishing twice never books twice.
 */

export type TravellerIn = Traveller & { kind: "adult" | "child" | "infant" };

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "XAF", "XOF"]);
const minor = (amount: number, currency: string) => Math.round(amount * (ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100));

/** A moved price needs the user's OK; rounding noise doesn't. */
const moved = (a: number, b: number) => Math.abs(a - b) > Math.max(1, b * 0.005);

export async function startCheckout(opts: {
  params: FlightSearchParams;
  fareKey: string;
  shownTotal: number;
  /** The quoted offer whose new price the user accepted: booked as is, without searching again. */
  offerId?: string;
  travellers: TravellerIn[];
  user?: { id: string; email?: string | null };
  appUrl: string;
}): Promise<{ url: string } | { priceChanged: DuffelFare }> {
  const { params, travellers } = opts;
  const fare = opts.offerId ? await getOffer(opts.offerId) : await quote(params, opts.fareKey, travellers);
  const kinds = travellers.map((t) => t.kind).sort().join();
  if (fare.key !== opts.fareKey || fare.passengers.map((p) => p.type).sort().join() !== kinds) {
    throw new DuffelError("expired", "offer_mismatch", "The accepted offer doesn't match these flights or travellers.");
  }
  if (moved(fare.total, opts.shownTotal)) return { priceChanged: fare };

  // The offer lists passengers adults first, then children, then infants: put the travellers in the same order.
  const order = (["adult", "child", "infant"] as const).flatMap((k) => travellers.filter((t) => t.kind === k));
  const route = `${params.originCode} → ${params.destinationCode}${params.returnDate ? " → " + params.originCode : ""}`;
  const meta: Record<string, string> = {
    kind: "flight",
    offer_id: fare.id,
    total: fare.total.toFixed(2),
    currency: fare.currency,
    pax: fare.passengers.map((p) => `${p.type[0]}:${p.id}`).join(","),
    route,
    airline: fare.airline.name,
    ...(opts.user ? { user_id: opts.user.id } : {}),
  };
  order.forEach((t, i) => {
    meta[`t${i}`] = JSON.stringify([t.title, t.gender, t.givenName, t.familyName, t.bornOn, t.email, t.phone]);
  });
  const params2: Record<string, string | number> = {
    mode: "payment",
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": fare.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": minor(fare.total, fare.currency),
    "line_items[0][price_data][product_data][name]": `Flight ${route}`,
    "line_items[0][price_data][product_data][description]": `${fare.airline.name} · ${params.departDate}${params.returnDate ? " to " + params.returnDate : ""} · ${travellers.length} traveller${travellers.length > 1 ? "s" : ""}${fare.testMode ? " · TEST BOOKING, no real ticket" : ""}`,
    customer_email: opts.user?.email || order[0].email,
    // Stripe's minimum; the fare itself is held for about as long.
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    success_url: `${opts.appUrl}/booking?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${opts.appUrl}/app`,
    ...(opts.user ? { client_reference_id: opts.user.id } : {}),
  };
  for (const [k, v] of Object.entries(meta)) {
    params2[`metadata[${k}]`] = v;
    if (k === "kind" || k === "offer_id") params2[`payment_intent_data[metadata][${k}]`] = v;
  }
  const session = await stripe<{ url: string }>("checkout/sessions", params2);
  return { url: session.url };
}

interface Session {
  id: string;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  metadata: Record<string, string>;
  payment_intent: { id: string; metadata: Record<string, string> } | null;
}

export type FinishResult =
  | { status: "booked"; order: OrderSummary }
  | { status: "unpaid" }
  | { status: "failed"; message: string; refunded: boolean }
  | { status: "not_found" };

// Two calls for the same payment in one server instance wait for the same booking.
const inFlight = new Map<string, Promise<FinishResult>>();

export function finishBooking(sessionId: string): Promise<FinishResult> {
  const running = inFlight.get(sessionId);
  if (running) return running;
  const p = finish(sessionId).finally(() => setTimeout(() => inFlight.delete(sessionId), 60_000));
  inFlight.set(sessionId, p);
  return p;
}

async function finish(sessionId: string): Promise<FinishResult> {
  const s = await stripe<Session>(`checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`).catch(() => null);
  if (!s || s.metadata?.kind !== "flight") return { status: "not_found" };
  if (s.payment_status !== "paid" || !s.payment_intent) return { status: "unpaid" };
  const pi = s.payment_intent;
  if (pi.metadata.duffel_order_id) return { status: "booked", order: orderSummary(await getOrder(pi.metadata.duffel_order_id)) };
  if (pi.metadata.duffel_status === "failed") return { status: "failed", message: pi.metadata.duffel_error || "The airline didn't confirm this booking.", refunded: true };

  const m = s.metadata;
  const passengers = m.pax.split(",").map((x) => {
    const [t, id] = x.split(":");
    return { id, type: (t === "a" ? "adult" : t === "c" ? "child" : "infant") as DuffelFare["passengers"][number]["type"] };
  });
  const travellers: Traveller[] = passengers.map((_, i) => {
    const [title, gender, givenName, familyName, bornOn, email, phone] = JSON.parse(m[`t${i}`]);
    return { title, gender, givenName, familyName, bornOn, email, phone };
  });
  try {
    const order = await createOrder({ id: m.offer_id, total: Number(m.total), currency: m.currency, passengers }, travellers, { stripe_session: s.id, ...(m.user_id ? { user_id: m.user_id } : {}) });
    await stripe(`payment_intents/${pi.id}`, { "metadata[duffel_order_id]": order.id, "metadata[booking_reference]": order.booking_reference });
    return { status: "booked", order: orderSummary(order) };
  } catch (err) {
    if (!(err instanceof DuffelError)) throw err;
    // The airline refused the order: give the money back.
    const message =
      err.code === "expired"
        ? "The airline no longer sells these seats at this price, so the booking wasn't made."
        : "The airline couldn't confirm this booking with the details given, so it wasn't made.";
    console.error("Duffel order failed:", err.duffelCode, err.message);
    let refunded = false;
    try {
      await stripe("refunds", { payment_intent: pi.id, reason: "requested_by_customer", "metadata[why]": `duffel:${err.duffelCode}` });
      refunded = true;
    } catch (e) {
      console.error("Refund failed:", (e as Error).message);
    }
    await stripe(`payment_intents/${pi.id}`, { "metadata[duffel_status]": "failed", "metadata[duffel_error]": message.slice(0, 450) }).catch(() => undefined);
    return { status: "failed", message, refunded };
  }
}
