"use client";
import { LineChart, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { TrackerCard } from "@/components/offers/OfferViews";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { useStore } from "@/lib/store/AppStore";
import { timeAgo } from "@/lib/utils";

export default function TrackingPage() {
  const store = useStore();
  const { t, trackers, ready, settings, refreshTrackers } = store;
  const last = trackers.map((x) => x.lastCheckedAt).sort().at(-1);

  // Prices checked on another device show up here too.
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
          <RefreshCw />
          <span>
            <b style={{ color: "var(--text)", fontWeight: 560 }}>Checked when you ask.</b> Tap “Run check” on an offer and Pyrius looks it up again with Google and records
            the real price. Each check uses one live search.
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
              body="Choose “Track price” on a flight or a stay to set a target. Run a check whenever you want today's real price, and see its history here."
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
