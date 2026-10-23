# Pyrius — AI travel concierge

Describe a trip in your own words; Pyrius asks only what it needs, then lays out flights, stays and cars,
lets you save offers and track their displayed price. Pyrius never books or takes payment for travel —
bookings happen with the provider.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Works with **no keys at all** (demo AI, demo travel data, browser-only storage, demo checkout).
Copy `.env.example` to `.env.local` to connect real services.

## Structure

| Layer | Where |
| --- | --- |
| Design tokens & styles | `src/styles/` (`tokens.css` = colors, type, spacing, radii, shadows, motion; dark default + designed light theme) |
| App shell, sidebar, mobile nav | `src/components/shell/AppShell.tsx` |
| Live AI orb (WebGL shader, CSS fallback) | `src/components/ai/LiveOrb.tsx`, `orbShader.ts`, `OrbStage.tsx` (one orb that flies welcome ↔ composer) |
| Motion system | `src/styles/motion.css` (durations, easings, keyframes, stagger) + `src/lib/motion.ts` (orb states, helpers) |
| Pointer light, card glow, parallax | `src/components/fx/PointerFX.tsx` + `src/styles/fx.css` (desktop fine pointers only) |
| Composer, conversation, trip brief | `src/components/chat/*` |
| Results (flights, hotels, cars, local businesses) | `src/components/results/*` |
| Saved offers, trackers, trips | `src/components/offers/*`, `src/components/tracking/*` |
| Conversation engine | `src/lib/ai/agent.ts` (state machine), `parse.ts` (EN/FR field parser), `followups.ts` |
| Travel provider adapters | `src/lib/providers/types.ts` (contracts), `demo.ts` (deterministic demo), `index.ts` (switch point) |
| Price tracking | `src/lib/tracking/simulator.ts` · production design in `docs/price-tracking.md` |
| Persistence | `src/lib/store/AppStore.tsx` + `repository.ts` (Local or Supabase) |
| Plans & entitlements | `src/lib/plans.ts`, Stripe in `src/app/api/checkout` and `src/app/api/stripe/webhook` |
| Database schema + RLS | `supabase/migrations/0001_pyrius.sql` |

## Integrations

- **OpenAI** (`OPENAI_API_KEY`): server-side, only extracts trip fields as validated JSON. It never produces
  offers or prices. Without it, a built-in EN/FR parser runs and the UI shows "Demo AI".
- **Supabase**: run the migration, add the URL + anon key. Users can sign in (`/login`); conversations,
  saved offers, trackers and settings sync per user under row-level security. Without it, data lives in
  `localStorage` and the app says so.
- **Stripe**: create monthly prices for Plus and Pro, set `STRIPE_PRICE_PLUS/PRO`, and point a webhook
  (`checkout.session.completed`, `customer.subscription.deleted`) at `/api/stripe/webhook`. Plans change only
  through that webhook (needs `SUPABASE_SERVICE_ROLE_KEY`). Without Stripe, "Upgrade" opens a labeled demo
  checkout and nothing is charged.
- **Travel APIs**: implement the interfaces in `src/lib/providers/types.ts` and return them from
  `getProviders()`. The UI calls `/api/search/[kind]` and doesn't change.

## Honest-by-design

- All flight, hotel and car prices are demonstration data and labeled as such. Outbound buttons open a general
  search (Google Flights, Booking.com, Kayak) with the trip's parameters — never a fake booking link.
- Price tracking is simulated and deterministic; it changes only when you run a check and is labeled simulated.
- Local businesses are only shown from a verified source. None is connected, so the directory shows an honest
  empty state with a map search instead of invented names or phone numbers.
- Plan prices (Free $0, Plus $9.99, Pro $19.99 CAD/month) are provisional product settings.
