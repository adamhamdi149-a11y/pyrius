# Pyrius handoff (mobile app and voice)

Context for a new Claude session. **No secrets are in this file or in Git.** Ask the owner for keys if a task needs them.

## Project
- Repo `adamhamdi149-a11y/pyrius`: Next.js web app at https://pyrius.app (Vercel project `pyrius`, team `team_c1TBEMhDmOLAbo5dmqk82jef`) plus the Expo app in `mobile/`.
- Work branch: `claude/amazing-brown-4jigdx`. PR #2 (mobile app and voice) and PR #3 (sign-up layout fix) are merged into `main`.
- The owner works on Windows (PowerShell, `C:\Users\user\pyrius\mobile`, `npx expo start`) and tests in Expo Go on a Samsung. Give exact copy-paste commands, step by step.

## What exists
- **Mobile** (`mobile/`, Expo SDK 58, Expo Router, Reanimated 4, expo-gl orb shader shared with the web): onboarding (splash, welcome, email, 6-digit code, alerts, location, light), chat (the orb stays alone while typing, Claude-style composer with dictation, voice button that becomes the orange send arrow, Preferences sheet), Claude-style drawer (avatar bottom-left, New chat bottom-right), voice screen (ChatGPT-style orb and settings), settings, saved, tracking, auth/callback. See `mobile/README.md`.
- **Voice**: `/api/voice/session` mints a short-lived OpenAI Realtime client secret (the key stays on the server); `/api/voice/tool` runs the same validated concierge tools, including the real SerpApi flight search; `/api/voice/transcribe` and `/api/voice/speak` power the take-turns mode in Expo Go. Live WebRTC voice needs an EAS dev build.
- **Shared code**: mobile imports the web's `src/lib` as `@/lib/...`; mobile's own code is `~/...`.
- Checks: root `npm test` (vitest), `npx tsc --noEmit`, `npm run build`; in `mobile/`: `npm run typecheck`, `npm run lint`, `npx expo export`.

## Security rules (owner's, keep them)
- Never put the OpenAI key or any permanent secret in the app, in `EXPO_PUBLIC_*` variables, or in Git. Only the Supabase URL and anon key go in `mobile/.env.local` (gitignored).
- Never invent flights, fares, airlines, booking links or availability. Never claim a booking without provider confirmation. Never start recording without a clear user action.

## Supabase setup status (Pyrius project, ref `wozgtnzpoxwttmdswizs`)
- The Supabase MCP in Claude sessions only sees the owner's other project ("slougy mobile app"), not Pyrius. The owner makes Pyrius changes in the dashboard.
- Done by the owner: redirect URLs (`exp://**`, `pyrius://**`), Resend SMTP.
- Last instruction given: add `{{ .Token }}` to the **Confirm signup** and **Magic Link** templates (Authentication → Emails → Templates) and keep the Email OTP length at 6. Not yet confirmed by the owner.

## Open items
1. Confirm the email code sign-in works end to end on the phone (enter email, get the code, continue to the alerts page).
2. Check the Vercel production deploy and env vars (`OPENAI_API_KEY`, `SERPAPI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Vercel MCP needs a fresh authorization link (`authorize_team_access`), valid about 10 minutes.
3. Device testing: mic permission, voice (take-turns in Expo Go; live voice after `eas build --profile development --platform android`), flight search by voice, Book button.
4. Not built yet: in-app purchases (RevenueCat), push notifications for price drops, the web's inline airport and date controls in the app.

## Environment notes
- The cloud container only reaches the npm registry. OpenAI, Supabase, SerpApi and Expo servers are blocked, so live services can't be tested from the container.
- The owner has given permission to deploy and merge PRs.
