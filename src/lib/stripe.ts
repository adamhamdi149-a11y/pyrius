import type { BillingInterval, PlanId } from "@/lib/types";

/** Minimal server-side Stripe client (form-encoded REST, no SDK). The secret key never leaves the server. */

export class StripeError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | undefined>;

export async function stripe<T = Record<string, unknown>>(path: string, params?: Params, method: "GET" | "POST" | "DELETE" = params ? "POST" : "GET"): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError(501, "Stripe is not configured");
  const body = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) : undefined;
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(method !== "GET" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: method !== "GET" ? body : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new StripeError(res.status, data?.error?.message ?? `Stripe ${res.status}`);
  return data as T;
}

/** The Stripe price for a plan and billing period (env vars set by scripts/stripe-setup.mjs). */
export function priceFor(plan: Exclude<PlanId, "free">, interval: BillingInterval): string | undefined {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}${interval === "year" ? "_YEARLY" : ""}`;
  return process.env[key];
}

/** Which Pyrius plan a Stripe price is (monthly or yearly). */
export function planForPrice(priceId: string | undefined): Exclude<PlanId, "free"> | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO || priceId === process.env.STRIPE_PRICE_PRO_YEARLY) return "pro";
  if (priceId === process.env.STRIPE_PRICE_PLUS || priceId === process.env.STRIPE_PRICE_PLUS_YEARLY) return "plus";
  return null;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: "incomplete" | "incomplete_expired" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
  items: { data: { price: { id: string } }[] };
}

/**
 * The plan and status Pyrius should record for a subscription. Paid features stay on while Stripe
 * is retrying a failed renewal (past_due); they end when it gives up or the subscription ends.
 */
export function entitlementFor(sub: StripeSubscription): { plan: PlanId; status: string } {
  const paid = planForPrice(sub.items?.data?.[0]?.price?.id);
  if (!paid) return { plan: "free", status: sub.status };
  if (sub.status === "active" || sub.status === "trialing") return { plan: paid, status: sub.cancel_at_period_end ? "canceling" : "active" };
  if (sub.status === "past_due") return { plan: paid, status: "past_due" };
  return { plan: "free", status: sub.status };
}
