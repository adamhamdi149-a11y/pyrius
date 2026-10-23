"use client";
import { Map } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { summarizeTrips, TripCard } from "@/components/offers/TripViews";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { useStore } from "@/lib/store/AppStore";

export default function TripsPage() {
  const store = useStore();
  const { t, conversations, saved, settings, ready } = store;
  const [del, setDel] = useState<string | null>(null);
  const trips = useMemo(() => summarizeTrips(conversations, saved, settings.locale), [conversations, saved, settings.locale]);
  const upcoming = trips.filter((x) => x.upcoming);
  const other = trips.filter((x) => !x.upcoming);

  return (
    <div className="main__scroll">
      <div className="page">
        <header className="page__head">
          <div>
            <h1 className="t-title">{t("trips.title")}</h1>
            <p className="page__sub">{t("trips.subtitle")}</p>
          </div>
          <Link href="/" className="btn btn--primary" onClick={() => store.setActiveId(null)}>
            {t("nav.new")}
          </Link>
        </header>
        {!ready ? (
          <div className="tripgrid">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={280} r={20} />
            ))}
          </div>
        ) : trips.length === 0 ? (
          <div className="box">
            <EmptyState
              icon={<Map />}
              title={t("empty.startTitle")}
              body="Every conversation with the assistant becomes a trip you can come back to."
              action={
                <Link href="/" className="btn btn--primary" onClick={() => store.setActiveId(null)}>
                  {t("empty.startCta")}
                </Link>
              }
            />
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section>
                <div className="section__head">
                  <h2 className="t-h2">Upcoming</h2>
                </div>
                <div className="tripgrid">
                  {upcoming.map((tr, i) => (
                    <TripCard key={tr.conv.id} trip={tr} index={i} onDelete={() => setDel(tr.conv.id)} />
                  ))}
                </div>
              </section>
            )}
            {other.length > 0 && (
              <section className={upcoming.length ? "section" : undefined}>
                <div className="section__head">
                  <h2 className="t-h2">In progress</h2>
                </div>
                <div className="tripgrid">
                  {other.map((tr, i) => (
                    <TripCard key={tr.conv.id} trip={tr} index={i} onDelete={() => setDel(tr.conv.id)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <ConfirmDialog
        open={del !== null}
        onClose={() => setDel(null)}
        onConfirm={() => del && store.deleteConversation(del)}
        title="Delete this trip?"
        description="The conversation is removed. Saved offers and tracked prices are kept."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
