import type { PlanDefinition, PlanId, Subscription } from "@/lib/types";

/**
 * Plan catalogue and entitlements. Provisional product settings — not validated market prices.
 * The client reads these for display only; the authoritative plan comes from the backend
 * (Supabase `subscriptions`, written exclusively by the Stripe webhook).
 */
export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    monthlyCAD: 0,
    tagline: "Plan trips with the AI concierge.",
    limits: { trackers: 3, saved: 25 },
    features: ["Unlimited AI trip planning", "Save up to 25 offers", "Track 3 prices", "Light & dark themes"],
    provisional: true,
  },
  {
    id: "plus",
    name: "Plus",
    monthlyCAD: 9.99,
    tagline: "For travelers who are always watching a fare.",
    limits: { trackers: 25, saved: 250 },
    features: ["Everything in Free", "Track up to 25 prices", "Price-alert emails", "Saved-search alerts", "Priority AI responses"],
    provisional: true,
  },
  {
    id: "pro",
    name: "Pro",
    monthlyCAD: 19.99,
    tagline: "For frequent flyers and trip planners.",
    limits: { trackers: 100, saved: 1000 },
    features: ["Everything in Plus", "Track up to 100 prices", "Multi-trip planning", "Early access to new features"],
    provisional: true,
  },
];

export const planById = (id: PlanId) => PLANS.find((p) => p.id === id) ?? PLANS[0];

export const DEFAULT_SUBSCRIPTION: Subscription = { plan: "free", status: "active", source: "default" };

export function canAddTracker(sub: Subscription, activeTrackers: number) {
  return activeTrackers < planById(sub.plan).limits.trackers;
}

export function canSave(sub: Subscription, saved: number) {
  return saved < planById(sub.plan).limits.saved;
}
