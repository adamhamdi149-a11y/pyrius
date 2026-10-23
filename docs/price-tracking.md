# Price tracking — demo today, production later

## What runs today (demo)

- `src/lib/tracking/simulator.ts` generates a **deterministic** sample history when a price is first tracked
  (`sampleHistory`) and a new point only when the user explicitly runs a check (`simulateCheck`).
- Every point carries `simulated: true`. The UI labels trackers, charts and toasts as simulated and never
  reports a real-world fare change.
- Trackers are stored with the shape in `PriceTracker` (`src/lib/types.ts`): provider, provider offer id,
  route/property label, travel dates, travelers, currency, saved / last known / target price, last check,
  status and a timestamped history.

## Production design

Price checks must run **server-side**, never from the browser, and never by scraping sites without permission.

1. **Scheduler** — a cron (Supabase Scheduled Function, Vercel Cron, or a worker) wakes up every N minutes
   and selects due trackers: `status = 'active'` and `last_checked_at < now() - interval` where the interval
   depends on plan and on how close the travel date is (e.g. every 12 h, every 3 h inside 14 days).
2. **Provider adapter** — implement `PriceCheckProvider` (`src/lib/providers/types.ts`) for the real API
   (e.g. Duffel/Amadeus offers re-pricing, a hotel affiliate API). Re-price by `provider_offer_id` when the
   provider supports it; otherwise run the original search and match by itinerary/property.
3. **Rate limits** — batch per provider, respect documented quotas, use a token bucket per API key, and
   back off exponentially on `429`/`5xx`. Spread checks across the interval rather than bursting.
4. **Provider errors** — record failures without touching the price. After several consecutive failures,
   mark the tracker `unavailable` and tell the user plainly; never invent a price.
5. **Stale or unavailable offers** — when the provider says the offer no longer exists, keep the history,
   set status `unavailable`, and offer "find similar" instead of showing an old price as current.
6. **Currency normalization** — store the provider's original amount + currency in the history, convert to
   the tracker currency with a dated FX rate from a reliable source, and keep the rate used.
7. **Price comparison** — compare like with like (same travelers, cabin, baggage, dates). A target is
   "reached" when `last_known_price <= target_price`; ignore movements under a small threshold (e.g. 1 %)
   to avoid noise.
8. **Notifications** — only for `simulated = false` points. Enqueue an email/push job (Resend, Postmark,
   FCM…) respecting the user's notification settings, de-duplicate per tracker per day, and include the
   provider and check time so the user can verify the price before booking.
9. **Storage** — append to a `price_points` table (`tracker_id, at, amount, currency, source`) for long
   histories, and keep `price_trackers.last_known_price/last_checked_at/status` denormalized for fast reads.
   Row-level security keeps every tracker private to its owner.
