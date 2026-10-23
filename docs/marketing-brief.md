# Pyrius marketing site — production brief

Concept chosen by the owner: **Signal from Noise + your trip** (Lane A, pure code, live WebGL orb).

## Routing (done)
- `/` marketing film (`src/app/(marketing)/page.tsx`), `/legal/terms`, `/legal/privacy`.
- `/login` sign-in & sign-up (`src/app/(auth)/login`). Google/Apple buttons appear only when enabled in Supabase (`/auth/v1/settings`).
- Product lives under `src/app/(app)/` behind `AuthGate`: `/app` (assistant), `/dashboard`, `/saved`, `/tracking`, `/trips`, `/settings`, `/checkout/demo`.
- CTA "Try Pyrius" → signed in: `/app`; else `/login?mode=signup&next=/app`. A typed/picked trip is stored as `pyrius:pending-prompt` and pre-filled in the app composer.

## Story (one vector: everything converges into the orb)
1. Hero — orb right, big recognisable search-form fragments drifting around it. H1 "Flight search, reimagined." Trip composer + chips is the CTA.
2. `#how` (pinned) — "Search engines hand you a form." The trip sentence types into a composer at reading speed; each phrase pulls its form field into the orb. Ends "Pyrius starts with a sentence."
3. `#product` (pinned) — orb docks into the app composer; real conversation arrives message by message and stays; three flight cards from the app's own demo provider, labelled illustrative.
4. `#journey` (pinned horizontal on desktop, vertical on mobile) — save → track (chart drawn by the satellite) → stays & cars. CTA band after.
5. `#calm` — orb returns centre, single orbit, "Planning starts with a conversation."
6. `#start` — "Your next trip starts with a conversation." Try Pyrius + See how it works. Footer with legal links.

## Art direction
- Palette = app tokens: bg #090A0D, surface #101116/#16171D, text #F5F5F7, muted #9899A6, accent var(--accent) (#FF7628 default; honours the user's orb theme).
- Type: Geist (product) for body/UI and heavy display; Instrument Serif italic for the one emotional word per headline.
- Motion: scenery scrubs, text and UI arrive at reading speed and stay. Pins created before ambient triggers.

## Do-nots
- No fake stats, testimonials, savings, "cheapest", struck-through prices, or live-price claims. Prices = illustrative.
- Never narrate the mechanic in copy ("as you scroll…"). Run `copy-gate.js` on the rendered HTML.
- Pyrius never sells tickets or takes travel payments — bookings are with providers.
- Respect prefers-reduced-motion (static layout, no Lenis, no pins).
- Dev contract: `?jump=<y>` and `window.__ready`.
