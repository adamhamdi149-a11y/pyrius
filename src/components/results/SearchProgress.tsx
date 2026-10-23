import { Database } from "lucide-react";
import type { ReactNode } from "react";

/** Data source label shown wherever results come from the demo provider. */
export const DEMO_SOURCE = "Pyrius demo dataset";

/**
 * Shown only while a real search request is in flight. Names what is being
 * searched and where, instead of an anonymous spinner.
 */
export function SearchProgress({ what, children }: { what: string; children?: ReactNode }) {
  return (
    <div className="sprog" role="status" aria-live="polite">
      <div className="sprog__head">
        <span className="sprog__pulse" aria-hidden="true" />
        <span>
          Searching <b>{what}</b>
        </span>
        <span className="sprog__src">
          <Database />
          {DEMO_SOURCE}
        </span>
      </div>
      <div className="sprog__bar" aria-hidden="true">
        <i />
      </div>
      {children}
    </div>
  );
}

/** Honest provenance line under a finished search. */
export function SourceLine({ count, noun, ms }: { count: number; noun: string; ms?: number }) {
  return (
    <p className="source-line">
      <Database />
      <span>
        {DEMO_SOURCE} · {count} {noun}
        {ms !== undefined && ` · answered in ${ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}`}
      </span>
      <span className="source-line__note">Demo prices — not live fares or availability</span>
    </p>
  );
}
