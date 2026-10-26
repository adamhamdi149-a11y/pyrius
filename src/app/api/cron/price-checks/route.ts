import { NextResponse } from "next/server";
import { emailConfigured, sendPriceAlert } from "@/lib/email";
import { flightMode } from "@/lib/providers";
import { serpApiSearchesLeft } from "@/lib/providers/serpapi";
import { adminConfigured, getPlan, getSavedOffer, getUserEmail, getUserSettings, listCheckableTrackers, updateTracker } from "@/lib/supabase/admin";
import { recheckFlight, recheckStay } from "@/lib/tracking/recheck";
import { applyCheck, isDue, travelStarted, type CheckResult } from "@/lib/tracking/trackers";
import type { AnyOffer, PriceTracker } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Searches kept back for people searching in the app, so background checks never use the last of the month's quota. */
const RESERVE = Number(process.env.PRICE_CHECK_RESERVE ?? 40);
const MAX_PER_RUN = 60;
const TIME_BUDGET_MS = 48_000;

async function check(o: AnyOffer): Promise<CheckResult | null> {
  if (o.offer.source !== "live") return null;
  if (o.kind === "flight" && o.offer.booking) return recheckFlight({ outbound: o.offer.outbound, inbound: o.offer.inbound, booking: { params: o.offer.booking.params } });
  if (o.kind === "hotel" && o.offer.propertyToken && o.offer.params) return recheckStay({ propertyToken: o.offer.propertyToken, params: o.offer.params });
  return null;
}

/** Email when the price first reaches the target, and again only if it drops further. Plus and Pro, with alerts on. */
async function maybeAlert(userId: string, before: PriceTracker, after: PriceTracker): Promise<PriceTracker> {
  if (after.status !== "target-reached") return before.alertedPrice !== undefined ? { ...after, alertedPrice: undefined } : after;
  if (before.alertedPrice !== undefined && after.lastKnownPrice >= before.alertedPrice) return after;
  if (!emailConfigured()) return after;
  const [plan, settings] = await Promise.all([getPlan(userId), getUserSettings(userId)]);
  if (plan === "free" || settings?.notifications?.email === false || settings?.notifications?.priceAlerts === false) return after;
  const to = (await getUserEmail(userId)) ?? settings?.email;
  if (!to) return after;
  return (await sendPriceAlert(to, after)) ? { ...after, alertedPrice: after.lastKnownPrice } : after;
}

/**
 * Re-checks every tracked live price that hasn't been checked for 6 hours, records the real price
 * on the tracker, and emails price alerts. Called by Vercel Cron (daily) and a GitHub Actions
 * schedule (every 6 hours); calling it more often does nothing extra, because only due trackers run.
 * `?dry=1` checks prices without saving anything or sending email, to verify the job.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET isn't configured." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (flightMode() !== "live" || !adminConfigured()) return NextResponse.json({ ok: true, skipped: "Live data or the database isn't configured." });

  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const started = Date.now();
  const left = await serpApiSearchesLeft();
  const budget = Math.min(MAX_PER_RUN, left === null ? 20 : left - RESERVE);
  if (budget <= 0) return NextResponse.json({ ok: true, skipped: `Only ${left} searches left this month; keeping them for people searching in the app.` });

  const rows = await listCheckableTrackers();
  const due = rows.filter((r) => isDue(r.data, started)).slice(0, budget);
  const out = { ok: true, dry, due: due.length, checked: 0, changed: 0, unavailable: 0, alerts: 0, failed: 0, searchesLeft: left, results: [] as string[] };
  // The dry run also says why the others weren't due, without naming anyone.
  if (dry)
    for (const { data: t } of rows.filter((r) => !due.includes(r)))
      out.results.push(
        `${t.label}: not due (${t.source !== "live" ? "example offer" : t.status === "paused" ? "paused" : travelStarted(t, started) ? "trip already started" : `checked ${Math.round((started - new Date(t.lastCheckedAt).getTime()) / 3_600_000)} h ago`})`,
      );

  // A few at a time: identical searches share one provider call, and the run stays inside its time limit.
  const queue = [...due];
  const worker = async () => {
    while (queue.length && Date.now() - started < TIME_BUDGET_MS) {
      const { user_id, data: t } = queue.shift()!;
      try {
        const offer = await getSavedOffer(user_id, t.offerId);
        const result = offer && (await check(offer));
        if (!result) continue;
        let next = applyCheck(t, result);
        if (dry) out.results.push(`${t.label}: ${t.lastKnownPrice} → ${result.available ? result.price : "not sold any more"} ${t.currency}`);
        else {
          next = await maybeAlert(user_id, t, next);
          await updateTracker(user_id, next);
        }
        out.checked += 1;
        if (!result.available) out.unavailable += 1;
        else if (result.price !== t.lastKnownPrice) out.changed += 1;
        if (next.alertedPrice !== undefined && next.alertedPrice !== t.alertedPrice) out.alerts += 1;
      } catch (err) {
        out.failed += 1;
        console.error("Price check failed for a tracker:", (err as Error).message);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return NextResponse.json(out);
}
