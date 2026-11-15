import type { AnyOffer } from "@/lib/types";

/** One-line name for a saved or tracked offer. */
export function offerTitle(o: AnyOffer) {
  if (o.kind === "flight") return `${o.offer.airline.name} · ${o.offer.outbound.from} → ${o.offer.outbound.to}`;
  if (o.kind === "hotel") return `${o.offer.name}`;
  return `${o.offer.category} · ${o.offer.supplier}`;
}
