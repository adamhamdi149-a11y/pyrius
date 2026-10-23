"use client";
import { FlaskConical, LineChart, RefreshCw } from "lucide-react";
import Link from "next/link";
import { TrackerCard } from "@/components/offers/OfferViews";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { useStore } from "@/lib/store/AppStore";
import { timeAgo } from "@/lib/utils";

export default function TrackingPage() {
  const store = useStore();
  const toast = useToast();
  const { t, trackers, ready, settings } = store;
  const active = trackers.filter((x) => x.status !== "paused");
  const last = trackers.map((x) => x.lastCheckedAt).sort().at(-1);

  return (
    <div className="main__scroll">
      <div className="page">
        <header className="page__head">
          <div>
            <h1 className="t-title">{t("tracking.title")}</h1>
            <p className="page__sub">{t("tracking.subtitle")}</p>
          </div>
          {trackers.length > 0 && (
            <div style={{ display: "grid", justifyItems: "end", gap: 6 }}>
              <button
                className="btn btn--secondary"
                disabled={!active.length}
                onClick={() => {
                  const n = store.runSimulatedCheck();
                  toast({
                    tone: "info",
                    title: `Simulated check ran on ${active.length} offer${active.length > 1 ? "s" : ""}`,
                    description: n ? `${n} now at or below target in the simulation — not a real fare change.` : "Demo prices only. No live fares were checked.",
                  });
                }}
              >
                <RefreshCw />
                Run simulated check
              </button>
              {last && <span className="t-meta">Last simulated check {timeAgo(last, settings.locale)}</span>}
            </div>
          )}
        </header>

        <div className="notice" style={{ marginBottom: 20 }}>
          <FlaskConical />
          <span>
            <b style={{ color: "var(--text)", fontWeight: 560 }}>Simulation mode.</b> No live price source is connected, so new prices come from a deterministic demo simulator and only change when you
            run a check. Pyrius never reports a real-world price drop from simulated data.
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
              body="Open a flight, stay or car and choose “Track price” to set a target. You'll see its history here."
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
