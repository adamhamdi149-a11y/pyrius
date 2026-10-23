"use client";
import { Bookmark, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { describeOffer, OfferDetailDialog, SavedRow } from "@/components/offers/OfferViews";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { useStore } from "@/lib/store/AppStore";
import type { OfferKind, SavedOffer } from "@/lib/types";

type Tab = "all" | OfferKind;
type Sort = "recent" | "price-asc" | "price-desc" | "date";

function SavedInner() {
  const store = useStore();
  const { t, saved, settings, ready } = store;
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [open, setOpen] = useState<SavedOffer | null>(null);

  useEffect(() => {
    const p = params.get("tab");
    if (p === "flight" || p === "hotel" || p === "car") setTab(p);
  }, [params]);

  const counts = { all: saved.length, flight: 0, hotel: 0, car: 0 } as Record<Tab, number>;
  saved.forEach((s) => counts[s.kind]++);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const price = (s: SavedOffer) => store.trackerFor(s.id)?.lastKnownPrice ?? s.data.offer.totalPrice;
    return saved
      .filter((s) => tab === "all" || s.kind === tab)
      .filter((s) => !trackedOnly || store.trackerFor(s.id))
      .filter((s) => {
        if (!needle) return true;
        const d = describeOffer(s.data, settings.locale);
        return `${d.title} ${d.sub}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        if (sort === "price-asc") return price(a) - price(b);
        if (sort === "price-desc") return price(b) - price(a);
        if (sort === "date") return describeOffer(a.data).start.localeCompare(describeOffer(b.data).start);
        return b.savedAt.localeCompare(a.savedAt);
      });
  }, [saved, tab, q, sort, trackedOnly, settings.locale, store]);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="t-title">{t("saved.title")}</h1>
          <p className="page__sub">{t("saved.subtitle")}</p>
        </div>
      </header>

      <div className="tabs" role="tablist" aria-label="Category">
        {(
          [
            ["all", t("common.all")],
            ["flight", t("common.flights")],
            ["hotel", t("common.hotels")],
            ["car", t("common.cars")],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
            <span className="tabs__count">{counts[k]}</span>
          </button>
        ))}
      </div>

      {saved.length > 0 && (
        <div className="filters-row">
          <label className="input-affix">
            <Search />
            <input className="input" type="search" placeholder="Search saved offers" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search saved offers" />
          </label>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="recent">Recently saved</option>
            <option value="date">Travel date</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
          <button className="chip" aria-pressed={trackedOnly} onClick={() => setTrackedOnly((v) => !v)}>
            Tracked only
          </button>
        </div>
      )}

      {!ready ? (
        <div className="list">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={88} r={16} />
          ))}
        </div>
      ) : list.length ? (
        <div className="list">
          {list.map((s, i) => (
            <SavedRow key={s.id} item={s} onOpen={setOpen} index={i} />
          ))}
        </div>
      ) : (
        <div className="box">
          <EmptyState
            icon={<Bookmark />}
            title={saved.length ? "No offers match" : t("empty.startTitle")}
            body={saved.length ? "Try another search or category." : "Save flights, stays and cars from the assistant to compare them here."}
            action={
              saved.length ? (
                <button
                  className="btn btn--secondary"
                  onClick={() => {
                    setQ("");
                    setTab("all");
                    setTrackedOnly(false);
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <Link href="/" className="btn btn--primary" onClick={() => store.setActiveId(null)}>
                  {t("empty.startCta")}
                </Link>
              )
            }
          />
        </div>
      )}
      <OfferDetailDialog item={open} onClose={() => setOpen(null)} />
    </div>
  );
}

export default function SavedPage() {
  return (
    <div className="main__scroll">
      <Suspense>
        <SavedInner />
      </Suspense>
    </div>
  );
}
