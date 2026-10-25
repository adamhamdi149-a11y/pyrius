import type { BillingInterval, PlanDefinition, PlanId, Subscription } from "@/lib/types";

/**
 * Plan catalogue and entitlements, in US dollars. The client reads these for display and limits;
 * the authoritative plan comes from the backend (Supabase `subscriptions`, written only by the
 * Stripe webhook).
 */
export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    monthlyUSD: 0,
    yearlyMonthlyUSD: 0,
    tagline: "Try Pyrius on your next trip.",
    limits: { searches: 3, trackers: 1, saved: 1 },
    features: ["3 AI-assisted flight searches per month", "Save 1 flight offer", "Track 1 flight price", "Basic trip planning", "Access to available live flight results"],
  },
  {
    id: "plus",
    name: "Plus",
    monthlyUSD: 9.99,
    yearlyMonthlyUSD: 4.99,
    tagline: "For travelers who are always watching a fare.",
    limits: { searches: 30, trackers: 10, saved: Infinity },
    features: [
      "30 AI-assisted flight searches per month",
      "Save unlimited flight offers",
      "Track 10 flight prices",
      "Email price alerts",
      "Saved-search alerts",
      "Compare flexible travel dates",
      "AI trip refinements",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyUSD: 19.99,
    yearlyMonthlyUSD: 11.99,
    tagline: "For frequent flyers and trip planners.",
    limits: { searches: Infinity, trackers: Infinity, saved: Infinity },
    features: ["Unlimited AI-assisted flight searches", "Unlimited tracked flight prices", "Unlimited saved flight offers", "Email price and saved-search alerts", "Priority support"],
  },
];

export const planById = (id: PlanId) => PLANS.find((p) => p.id === id) ?? PLANS[0];

export const DEFAULT_SUBSCRIPTION: Subscription = { plan: "free", status: "active", source: "default" };

/** "$9.99" — plan prices are always US dollars. */
export const usd = (n: number) => `$${n % 1 ? n.toFixed(2) : n}`;

/** What the plan costs per month, and per charge, for a billing interval. */
export function planPrice(p: PlanDefinition, interval: BillingInterval) {
  const perMonth = interval === "year" ? p.yearlyMonthlyUSD : p.monthlyUSD;
  return { perMonth, charged: interval === "year" ? Math.round(perMonth * 12 * 100) / 100 : perMonth };
}

/** Biggest yearly saving across paid plans, as a whole percentage. */
export const YEARLY_SAVING = Math.max(...PLANS.filter((p) => p.monthlyUSD).map((p) => Math.round((1 - p.yearlyMonthlyUSD / p.monthlyUSD) * 100)));

/** "10", or "unlimited". */
export const limitText = (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "unlimited");

export function canAddTracker(sub: Subscription, activeTrackers: number) {
  return activeTrackers < planById(sub.plan).limits.trackers;
}

export function canSave(sub: Subscription, saved: number) {
  return saved < planById(sub.plan).limits.saved;
}
