"use client";
import { ArrowRight, BedDouble, Bell, CalendarClock, LineChart, Plane, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LiveOrb } from "@/components/ai/LiveOrb";
import { OfferDetailDialog, SavedRow, TrackerRow } from "@/components/offers/OfferViews";
import { Services } from "@/components/offers/Services";
import { summarizeTrips, TripRow, TripSpotlight } from "@/components/offers/TripViews";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { useStore } from "@/lib/store/AppStore";
import type { OfferKind, SavedOffer } from "@/lib/types";

function greeting(locale: string, name: string) {
  const h = new Date().getHours();
  const part = locale === "fr" ? (h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir") : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name.split(" ")[0]}` : part;
}

export default function DashboardPage() {
  const store = useStore();
  const { t, settings, saved, trackers, conversations, ready, refreshTrackers } = store;
  const [tab, setTab] = useState<"all" | OfferKind>("all");
  const [open, setOpen] = useState<SavedOffer | null>(null);
  const trips = useMemo(() => summarizeTrips(conversations, saved, settings.locale), [conversations, saved, settings.locale]);
  const upcoming = trips.filter((x) => x.upcoming).sort((a, b) => (a.conv.prefs.departDate ?? "").localeCompare(b.conv.prefs.departDate ?? ""));
  const focus = upcoming[0] ?? trips[0];
  const atTarget = trackers.filter((x) => x.status === "target-reached").length;
  const list = saved.filter((s) => tab === "all" || s.kind === tab).slice(0, 5);
  const isEmpty = ready && !saved.length && !trackers.length && !trips.length;

  // Prices checked on another device since the last visit.
  useEffect(() => {
    if (ready) refreshTrackers();
  }, [ready, refreshTrackers]);

  const metrics = [
    { label: t("dash.savedFlights"), value: saved.filter((s) => s.kind === "flight").length, icon: Plane, href: "/saved?tab=flight", sub: "Ready to compare" },
    { label: t("dash.tracked"), value: trackers.length, icon: Bell, href: "/tracking", sub: atTarget ? `${atTarget} at or below target` : trackers.length ? "Run a check any time" : "Nothing tracked yet", accent: atTarget > 0 },
    { label: t("dash.savedStays"), value: saved.filter((s) => s.kind === "hotel").length, icon: BedDouble, href: "/saved?tab=hotel", sub: "Hotels & apartments" },
    { label: t("dash.upcoming"), value: upcoming.length, icon: CalendarClock, href: "/trips", sub: upcoming[0] ? `Next: ${upcoming[0].dest}` : "Nothing planned yet" },
  ];

  return (
    <div className="main__scroll">
      <div className="page">
        <header className="page__head">
          <div>
            <div className="t-eyebrow">{greeting(settings.locale, settings.name)}</div>
            <h1 className="t-title" style={{ marginTop: 6 }}>
              {t("dash.title")}
            </h1>
            <p className="page__sub">{t("dash.subtitle")}</p>
          </div>
          <Link href="/app" className="btn btn--primary" onClick={() => store.setActiveId(null)}>
            <Plus />
            {t("nav.new")}
          </Link>
        </header>

        {focus && (
          <TripSpotlight
            trip={focus}
            saved={saved}
            trackedCount={trackers.filter((tr) => saved.some((sv) => sv.id === tr.offerId && sv.conversationId === focus.conv.id)).length}
          />
        )}

        <div className="metrics">
          {metrics.map(({ label, value, icon: Icon, href, sub, accent }) => (
            <Link key={label} href={href} data-glow className={`metric m-press ${accent ? "metric--accent" : ""}`}>
              <div className="metric__top">
                {label}
                <Icon />
              </div>
              {ready ? <div className="metric__value num">{value}</div> : <Skeleton w={40} h={30} />}
              <div className="metric__sub">{sub}</div>
            </Link>
          ))}
        </div>

        <Services />

        {isEmpty ? (
          <section className="welcome-panel">
            <div className="panel-orb">
              <LiveOrb mood="idle" />
            </div>
            <div>
              <h2 className="t-h2">{t("empty.startTitle")}</h2>
              <p className="t-body" style={{ marginTop: 6, maxWidth: 520 }}>
                {t("empty.startBody")}
              </p>
              <ul className="howto">
                <li>
                  <b>
                    <i>1</i>Describe it
                  </b>
                  Tell the assistant where, when and with whom — in your own words.
                </li>
                <li>
                  <b>
                    <i>2</i>Save what you like
                  </b>
                  Keep flights and stays side by side, and reach the companies you need.
                </li>
                <li>
                  <b>
                    <i>3</i>Watch the price
                  </b>
                  Set a target, then run a check whenever you want today's real price.
                </li>
              </ul>
              <Link href="/app" className="btn btn--primary" style={{ marginTop: 18 }} onClick={() => store.setActiveId(null)}>
                {t("empty.startCta")}
                <ArrowRight />
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="dash-grid">
              <section className="box" aria-labelledby="tracked-title">
                <div className="box__head">
                  <h2 id="tracked-title" className="t-h3">
                    {t("dash.trackedTitle")}
                  </h2>
                  <Link href="/tracking" className="section__link">
                    {t("dash.viewAll")}
                    <ArrowRight />
                  </Link>
                </div>
                <div className="box__body">
                  {trackers.length ? (
                    trackers.slice(0, 4).map((tr) => <TrackerRow key={tr.id} t={tr} />)
                  ) : (
                    <EmptyState icon={<LineChart />} title="No prices tracked yet" body="Use “Track price” on a flight or a stay. Run a check any time to record today's real price." />
                  )}
                </div>
              </section>
              <section className="box" aria-labelledby="trips-title">
                <div className="box__head">
                  <h2 id="trips-title" className="t-h3">
                    {t("dash.tripsTitle")}
                  </h2>
                  <Link href="/trips" className="section__link">
                    {t("dash.viewAll")}
                    <ArrowRight />
                  </Link>
                </div>
                <div className="box__body">
                  {trips.length ? (
                    trips.slice(0, 5).map((tr) => <TripRow key={tr.conv.id} trip={tr} />)
                  ) : (
                    <EmptyState icon={<Plane />} title="No trips yet" body="Conversations with the assistant become trips you can reopen." />
                  )}
                </div>
              </section>
            </div>

            <section className="section" aria-labelledby="saved-title">
              <div className="section__head">
                <h2 id="saved-title" className="t-h2">
                  {t("dash.savedTitle")}
                </h2>
                <div className="seg" role="tablist" aria-label="Category">
                  {(
                    [
                      ["all", t("common.all")],
                      ["flight", t("common.flights")],
                      ["hotel", t("common.hotels")],
                    ] as const
                  ).map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {list.length ? (
                <div className="list">
                  {list.map((s, i) => (
                    <SavedRow key={s.id} item={s} onOpen={setOpen} index={i} />
                  ))}
                  {saved.filter((s) => tab === "all" || s.kind === tab).length > 5 && (
                    <Link href="/saved" className="btn btn--ghost" style={{ justifySelf: "center" }}>
                      See all saved offers
                    </Link>
                  )}
                </div>
              ) : (
                <div className="box">
                  <EmptyState
                    icon={<BedDouble />}
                    title={tab === "all" ? "Nothing saved yet" : `No saved ${tab === "flight" ? "flights" : tab === "hotel" ? "stays" : "cars"}`}
                    body="Tap Save on any result and it will appear here."
                  />
                </div>
              )}
            </section>
          </>
        )}
      </div>
      <OfferDetailDialog item={open} onClose={() => setOpen(null)} />
    </div>
  );
}
