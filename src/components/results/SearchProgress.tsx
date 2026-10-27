import { Database } from "lucide-react";
import type { ReactNode } from "react";

/** Data source label shown wherever results come from the demo provider. */
export const DEMO_SOURCE = "Pyrius demo dataset";

/**
 * Shown only while a real search request is in flight. Names what is being
 * searched and where, instead of an anonymous spinner.
 */
export function SearchProgress({ what, children, source = DEMO_SOURCE }: { what: string; children?: ReactNode; source?: string }) {
  return (
    <div className="sprog" role="status" aria-live="polite">
      <div className="sprog__head">
        <span className="sprog__pulse" aria-hidden="true" />
        <span>
          Searching <b>{what}</b>
        </span>
        <span className="sprog__src">
          <Database />
          {source}
        </span>
      </div>
      <div className="sprog__bar" aria-hidden="true">
        <i />
      </div>
      {children}
    </div>
  );
}

/** Honest provenance line under a finished search: where the results came from, and when. */
export function SourceLine({ count, noun, ms, live, provider, fetchedAt, note }: { count: number; noun: string; ms?: number; live?: boolean; provider?: string; fetchedAt?: string; note?: string }) {
  const at = fetchedAt ? new Date(fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <p className="source-line" data-live={Boolean(live)}>
      <Database />
      <span>
        {live ? provider ?? "Live provider" : DEMO_SOURCE} · {count} {noun}
        {live && at ? ` · retrieved at ${at}` : ""}
        {!live && ms !== undefined && ` · answered in ${ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}`}
      </span>
      <span className="source-line__note">{live ? (note ?? "Live fares · prices can change until you book") : "Demo prices — not live fares or availability"}</span>
    </p>
  );
}
