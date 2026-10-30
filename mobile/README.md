# Pyrius mobile (iOS and Android)

The Pyrius app for the App Store and Google Play. Built with Expo (SDK 58) and Expo Router, in
TypeScript. It talks to the same Pyrius server as the website (`../src/app/api`) and shares the web
app's own code for the parts that aren't UI: types, plans, the airport list, the orb shader and
themes, flight helpers and Supabase storage (`../src/lib`, imported as `@/lib/...`).

## Run it on your phone

```bash
cd mobile
npm install
cp .env.example .env.local     # then fill in the values (see below)
npx expo start                 # scan the QR code with Expo Go (Android) or the Camera app (iPhone)
```

`.env.local` only holds public values:

| Variable | What |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | The Pyrius server, `https://pyrius.app` once the voice routes are deployed. For local development: run the website with `npm run dev` and use your computer's LAN address, e.g. `http://192.168.1.20:3000`. |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |

Never put the OpenAI, SerpApi, Stripe secret or Supabase service-role keys here: everything named
`EXPO_PUBLIC_` is built into the app.

## How the screens connect

`src/lib/flow.ts` is the one map of the app. Each screen belongs to a phase, and the root layout
(`src/app/_layout.tsx`) guards the screens with `Stack.Protected`:

| Phase | Screens, in order |
| --- | --- |
| signed-out | welcome → email → code |
| setup | alerts → location → light |
| app | chat, settings, saved, tracking, voice |

Signing in, finishing setup or signing out changes the phase. The router then closes the old phase's
screens and `index` opens the first screen of the new one, so no screen hard-codes where to go next.
The native splash stays up until sign-in and setup state are loaded (never longer than 6 seconds on a
bad connection). A code that was sent but not entered yet is remembered for an hour: if the app closes
while you read the email, it reopens on the code screen.

## Voice: Expo Go vs the Pyrius build

| | Expo Go | Pyrius development / store build |
| --- | --- | --- |
| Chat, onboarding, flights, menu, settings | yes | yes |
| Dictation (mic button in the chat bar) | yes | yes |
| Voice conversation | take turns: Pyrius listens until you pause, answers through the text concierge, reads the answer aloud | live speech-to-speech (OpenAI Realtime over WebRTC): talk naturally, interrupt any time |

Live voice uses `react-native-webrtc`, a native module Expo Go doesn't include. Build the app once
with EAS (free tier, no Mac needed, iOS builds run in Expo's cloud):

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android   # installable APK for your Samsung
npx expo start --dev-client                                         # then open the installed Pyrius app
```

For an iPhone development build you need an Apple Developer account ($99/year). To try iPhone
screens without one, make a simulator build (`eas build --profile development --platform ios` with
`"ios": { "simulator": true }` in the profile) and run it on appetize.io.

## Store builds

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform ios       # App Store Connect
npx eas-cli@latest submit --platform android   # Google Play Console
```

Bundle ID / package name: `app.pyrius.mobile` (change in `app.json` before the first store build if you want another).

## One-time setup outside the code

1. **Deploy the website** (merge this branch): the app needs the new routes `/api/voice/session`,
   `/api/voice/tool`, `/api/voice/transcribe`, `/api/voice/speak` and `/api/flights/handoff` on
   `EXPO_PUBLIC_API_URL`.
2. **Server secrets** (Vercel → Project → Settings → Environment Variables): `OPENAI_API_KEY` and
   `SERPAPI_API_KEY` (already used by the website), `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optional: `OPENAI_REALTIME_MODEL` (default `gpt-realtime-2.1-mini`),
   `OPENAI_TRANSCRIBE_MODEL` (default `gpt-4o-mini-transcribe`), `OPENAI_TTS_MODEL`
   (default `gpt-4o-mini-tts`), `VOICE_MAX_SESSION_SECONDS` (default 900).
3. **Supabase → Authentication → Email templates**: sign-in uses a 6-digit code. Put `{{ .Token }}` in
   the *Magic Link* and *Confirm signup* templates (for example "Your Pyrius code: {{ .Token }}").
   Keep the code length at 6 (Authentication → Providers → Email).
4. **Supabase → Authentication → URL Configuration → Redirect URLs** (only for Google/Apple sign-in):
   add `pyrius://auth/callback`, and for Expo Go the `exp://…/--/auth/callback` address printed by
   `npx expo start`. The Google and Apple buttons only appear when those providers are enabled in Supabase.

## How voice works

- The app asks the Pyrius server for a voice session (`/api/voice/session`). The server checks the
  signed-in user, rate-limits (4 per minute, 60 per day), builds Pyrius's instructions, the
  conversation so far and the tools, and gets a short-lived client secret from OpenAI
  (`/v1/realtime/client_secrets`). The permanent OpenAI key never leaves the server.
- The app connects to OpenAI with that secret over WebRTC (`/v1/realtime/calls`): microphone and voice
  as audio tracks (with the phone's echo cancellation), events on the `oai-events` data channel.
- When the model calls a tool (update the trip, search flights, compare offers, save, track), the app
  sends it to `/api/voice/tool`, which runs the same validated tools as the text concierge, including the
  real Google Flights search through SerpApi. Results go back to the model and appear as cards in the
  chat. The model never gets flight data from anywhere else.
- What you say and what Pyrius answers (transcripts), the cards and the trip changes are stored in the
  same conversation as typed messages, so you can switch between talking and typing at any time.
- States on screen come from real events: listening (server voice detection), thinking (response
  started or a tool running), speaking (Pyrius's audio playing). The orb moves with the real audio
  levels from WebRTC's statistics.
- Sessions end when you close voice, after `VOICE_MAX_SESSION_SECONDS`, or when the app goes to the
  background. Pyrius doesn't record or store audio.

Voices offered: Marin, Cedar, Coral, Sage, Verse, Ash (server allowlist in `../src/lib/ai/voice/index.ts`).

## Checks

```bash
npm run typecheck
npm run lint
npx expo export --platform ios --platform android   # bundles the app the way a build does
```

Device tests still to do on a real phone: the email code, microphone permission (allow and deny),
a live voice session (talk, interrupt, mute, type in voice, end), a flight search by voice, the
Book button, and the take-turns mode in Expo Go.

## Not included yet

- Purchases: the Plus and Pro plans aren't sold in the app. Digital subscriptions in the App Store
  and Google Play generally have to use in-app purchase (for example RevenueCat), not Stripe.
- Push notifications for price drops: the permission is asked, but nothing sends them yet (the server
  doesn't re-check fares automatically).
