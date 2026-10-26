"use client";
import { Clock, LineChart } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { TrackerCard } from "@/components/offers/OfferViews";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { planById } from "@/lib/plans";
import { useStore } from "@/lib/store/AppStore";
import { CHECK_EVERY_HOURS } from "@/lib/tracking/trackers";
import { timeAgo } from "@/lib/utils";

export default function TrackingPage() {
  const store = useStore();
  const { t, trackers, ready, settings, subscription, refreshTrackers } = store;
  const last = trackers.map((x) => x.lastCheckedAt).sort().at(-1);
  const alerts = planById(subscription.plan).id !== "free" && settings.notifications.email && settings.notifications.priceAlerts;

  // Show the prices the scheduled checks recorded since this page was last open.
  useEffect(() => {
    if (ready) refreshTrackers();
  }, [ready, refreshTrackers]);

  return (
    <div className="main__scroll">
      <div className="page">
        <header className="page__head">
          <div>
            <h1 className="t-title">{t("tracking.title")}</h1>
            <p className="page__sub">{t("tracking.subtitle")}</p>
          </div>
          {last && <span className="t-meta">Last check {timeAgo(last, settings.locale)}</span>}
        </header>

        <div className="notice" style={{ marginBottom: 20 }}>
          <Clock />
          <span>
            <b style={{ color: "var(--text)", fontWeight: 560 }}>Checked automatically every {CHECK_EVERY_HOURS} hours,</b> even when Pyrius is closed. Each check looks the exact offer up
            again with Google and records the real price.{" "}
            {alerts ? (
              "You'll get an email when a price reaches your target."
            ) : planById(subscription.plan).id === "free" ? (
              <>
                Email alerts when a price reaches your target come with{" "}
                <Link href="/settings?section=subscription" className="link">
                  Plus and Pro
                </Link>
                .
              </>
            ) : (
              <>
                Email alerts are off;{" "}
                <Link href="/settings?section=notifications" className="link">
                  turn them on
                </Link>{" "}
                to hear when a price reaches your target.
              </>
            )}
          </span>
        </div>

        {!ready ? (
          <Skeleton h={260} r={20} />
        ) : trackers.length ? (
          <div className="list" style={{ gap: 14 }}>
            {trackers.map((tr, i) => (
              <TrackerCard key={tr.id} t={tr} index={i} />
            ))}
          </div>
        ) : (
          <div className="box">
            <EmptyState
              icon={<LineChart />}
              title="You're not tracking any prices"
              body="Choose “Track price” on a flight or a stay to set a target. Pyrius checks it every 6 hours and shows its history here."
              action={
                <Link href="/app" className="btn btn--primary" onClick={() => store.setActiveId(null)}>
                  {t("empty.startCta")}
                </Link>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
