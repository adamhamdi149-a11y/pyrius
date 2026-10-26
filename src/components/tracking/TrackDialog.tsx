"use client";
import { BellRing, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { CHECK_EVERY_HOURS, suggestedTarget } from "@/lib/tracking/trackers";
import type { AnyOffer, Currency } from "@/lib/types";
import { money } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** For new trackers. */
  offer?: AnyOffer;
  title: string;
  subtitle?: string;
  currentPrice: number;
  currency: Currency;
  initialTarget?: number;
  locale?: string;
  isEditing?: boolean;
  onConfirm: (target: number) => void;
  onStop?: () => void;
}

/** Set or change a target price, and say plainly how and how often the price is checked. */
export function TrackDialog({ open, onClose, title, subtitle, currentPrice, currency, initialTarget, locale = "en", isEditing, onConfirm, onStop }: Props) {
  const [target, setTarget] = useState(initialTarget ?? suggestedTarget(currentPrice));
  useEffect(() => {
    if (open) setTarget(initialTarget ?? suggestedTarget(currentPrice));
  }, [open, initialTarget, currentPrice]);

  const valid = Number.isFinite(target) && target > 0;
  const pct = valid ? Math.round(((currentPrice - target) / currentPrice) * 100) : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit price tracking" : "Track this price"}
      description={
        <>
          {title}
          {subtitle && <span style={{ display: "block", color: "var(--text-3)" }}>{subtitle}</span>}
        </>
      }
      wide
      footer={
        <>
          {onStop && (
            <button className="btn btn--danger" style={{ marginRight: "auto" }} onClick={onStop}>
              Stop tracking
            </button>
          )}
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={!valid} onClick={() => onConfirm(Math.round(target))} data-autofocus>
            <BellRing />
            {isEditing ? "Save target" : "Start tracking"}
          </button>
        </>
      }
    >
      <div className="track">
        <div className="track__row">
          <div>
            <div className="t-eyebrow">Displayed price</div>
            <div className="track__price num">{money(currentPrice, currency, locale)}</div>
          </div>
          <label className="field" style={{ minWidth: 0, flex: 1, maxWidth: 220 }}>
            <span className="field__label">Target price</span>
            <span className="input-affix">
              <span className="track__cur" aria-hidden="true">{currency === "EUR" ? "€" : "$"}</span>
              <input
                className="input num"
                type="number"
                inputMode="numeric"
                min={1}
                value={Number.isFinite(target) ? target : ""}
                onChange={(e) => setTarget(e.target.valueAsNumber)}
                aria-describedby="track-hint"
              />
            </span>
            <span id="track-hint" className="field__hint">
              {valid ? (pct > 0 ? `${pct}% below the displayed price` : pct === 0 ? "Same as the displayed price" : `${-pct}% above the displayed price`) : "Enter an amount"}
            </span>
          </label>
        </div>

        <div className="track__presets">
          {[5, 10, 15].map((p) => {
            const v = Math.round((currentPrice * (1 - p / 100)) / 5) * 5;
            return (
              <button key={p} className="chip" aria-pressed={target === v} onClick={() => setTarget(v)}>
                −{p}% · <span className="num">{money(v, currency, locale)}</span>
              </button>
            );
          })}
        </div>

        <div className="notice">
          <Clock />
          <span>
            <b style={{ color: "var(--text)", fontWeight: 560 }}>Checked every {CHECK_EVERY_HOURS} hours.</b> Pyrius looks this exact offer up again with Google, even when the app is
            closed, and records each real price. With Plus or Pro you also get an email when it reaches your target.
          </span>
        </div>
      </div>
    </Dialog>
  );
}
