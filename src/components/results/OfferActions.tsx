"use client";
import { Bell, BellRing, Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TrackDialog } from "@/components/tracking/TrackDialog";
import { useToast } from "@/components/ui/Toast";
import { useStore } from "@/lib/store/AppStore";
import type { AnyOffer } from "@/lib/types";
import { cx, money } from "@/lib/utils";

export function offerTitle(o: AnyOffer) {
  if (o.kind === "flight") return `${o.offer.airline.name} · ${o.offer.outbound.from} → ${o.offer.outbound.to}`;
  if (o.kind === "hotel") return `${o.offer.name}`;
  return `${o.offer.category} · ${o.offer.supplier}`;
}

const PROVIDER_NAME = { flight: "Google Flights", hotel: "Booking.com", car: "Kayak" } as const;

/** Save, track and outbound actions shared by every offer card. */
export function OfferActions({
  offer,
  conversationId,
  onSaved,
  compact,
}: {
  offer: AnyOffer;
  conversationId?: string;
  onSaved?: (kind: AnyOffer["kind"]) => void;
  compact?: boolean;
}) {
  const store = useStore();
  const toast = useToast();
  const router = useRouter();
  const [trackOpen, setTrackOpen] = useState(false);
  const saved = store.isSaved(offer.offer.id);
  const tracker = store.trackerFor(offer.offer.id);
  const loc = store.settings.locale;

  const limitToast = (message: string) =>
    toast({
      tone: "info",
      title: "Plan limit reached",
      description: message,
      action: { label: "See plans", onClick: () => router.push("/settings?section=subscription") },
    });

  const toggleSave = () => {
    if (saved) {
      store.removeSaved(offer.offer.id);
      toast({ tone: "info", title: "Removed from saved", description: tracker ? "Price tracking for this offer was stopped too." : undefined });
      return;
    }
    const r = store.saveOffer(offer, conversationId);
    if (!r.ok) return limitToast(r.message);
    toast({ tone: "save", title: "Saved to your offers", description: offerTitle(offer), action: { label: "View", onClick: () => router.push("/saved") } });
    onSaved?.(offer.kind);
  };

  const url = offer.offer.bookingUrl ?? offer.offer.searchUrl;
  const external = offer.offer.bookingUrl ? "View offer" : `Check on ${PROVIDER_NAME[offer.kind]}`;

  return (
    <div className={cx("offer-actions", compact && "offer-actions--compact")}>
      <button className="action" aria-pressed={saved} onClick={toggleSave} title={saved ? "Remove from saved" : "Save this offer"}>
        {saved ? <BookmarkCheck /> : <Bookmark />}
        <span>{saved ? store.t("common.saved") : store.t("common.save")}</span>
      </button>
      <button className="action" aria-pressed={Boolean(tracker)} onClick={() => setTrackOpen(true)} title={tracker ? "Edit price tracking" : "Track this price"}>
        {tracker ? <BellRing /> : <Bell />}
        <span>{tracker ? store.t("common.tracking") : store.t("common.track")}</span>
      </button>
      <a
        className="btn btn--secondary btn--sm offer-actions__out"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={offer.offer.bookingUrl ? "Continue to the provider to book" : `Opens a general ${PROVIDER_NAME[offer.kind]} search with your trip details. Prices there are live and will differ from this demo.`}
      >
        {external}
        <ExternalLink />
      </a>

      <TrackDialog
        open={trackOpen}
        onClose={() => setTrackOpen(false)}
        offer={offer}
        title={offerTitle(offer)}
        currentPrice={tracker?.lastKnownPrice ?? offer.offer.totalPrice}
        currency={offer.offer.currency}
        initialTarget={tracker?.targetPrice}
        locale={loc}
        isEditing={Boolean(tracker)}
        onStop={
          tracker
            ? () => {
                store.stopTracking(tracker.id);
                setTrackOpen(false);
                toast({ tone: "info", title: "Price tracking stopped" });
              }
            : undefined
        }
        onConfirm={(target) => {
          const wasSaved = saved;
          const r = store.startTracking(offer, target, conversationId);
          setTrackOpen(false);
          if (!r.ok) return limitToast(r.message);
          toast({
            tone: "success",
            title: tracker ? "Target updated" : "Tracking started (simulated)",
            description: `We'll flag it at ${money(target, offer.offer.currency, loc)} or less.`,
            action: { label: "Open", onClick: () => router.push("/tracking") },
          });
          if (!wasSaved) onSaved?.(offer.kind);
        }}
      />
    </div>
  );
}
