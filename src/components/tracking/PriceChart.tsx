"use client";
import { useId, useMemo, useRef, useState } from "react";
import type { Currency, PricePoint } from "@/lib/types";
import { money } from "@/lib/utils";

interface Props {
  history: PricePoint[];
  target?: number;
  currency: Currency;
  locale?: string;
  height?: number;
  compact?: boolean;
}

/** Lightweight SVG price chart: area + line, target line, current point and an accessible hover readout. */
export function PriceChart({ history, target, currency, locale = "en", height = 220, compact }: Props) {
  const id = useId().replace(/:/g, "");
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const pad = compact ? { l: 2, r: 2, t: 6, b: 6 } : { l: 8, r: 64, t: 18, b: 28 };

  const geo = useMemo(() => {
    const prices = history.map((p) => p.price);
    const vals = target ? [...prices, target] : prices;
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    const span = Math.max(max - min, max * 0.14);
    min -= span * 0.18;
    max += span * 0.18;
    const x = (i: number) => pad.l + (i / Math.max(1, history.length - 1)) * (W - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
    const pts = history.map((p, i) => [x(i), y(p.price)] as const);
    // Smooth path with gentle cubic segments.
    const line = pts.reduce((d, [px, py], i) => {
      if (i === 0) return `M${px},${py}`;
      const [qx, qy] = pts[i - 1];
      const cx = (qx + px) / 2;
      return `${d} C${cx},${qy} ${cx},${py} ${px},${py}`;
    }, "");
    const area = `${line} L${pts.at(-1)![0]},${H - pad.b} L${pts[0][0]},${H - pad.b} Z`;
    return { pts, line, area, y, min, max };
  }, [history, target, H, pad.l, pad.r, pad.t, pad.b]);

  if (history.length < 2) return null;
  const last = geo.pts.at(-1)!;
  const current = history.at(-1)!;
  const h = hover !== null ? history[hover] : null;
  const fmt = (v: number) => money(v, currency, locale);
  const first = history[0];
  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { month: "short", day: "numeric" });

  return (
    <div
      ref={wrap}
      className="chart"
      onPointerMove={(e) => {
        if (compact) return;
        const r = wrap.current!.getBoundingClientRect();
        const rel = ((e.clientX - r.left) / r.width) * W;
        const i = Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (history.length - 1));
        setHover(Math.max(0, Math.min(history.length - 1, i)));
      }}
      onPointerLeave={() => setHover(null)}
      role="img"
      aria-label={`Simulated price history: from ${fmt(first.price)} to ${fmt(current.price)}${target ? `, target ${fmt(target)}` : ""}.`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.24" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {!compact &&
          [0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + f * (H - pad.t - pad.b)} y2={pad.t + f * (H - pad.t - pad.b)} stroke="var(--border-soft)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
        <path d={geo.area} fill={`url(#a${id})`} className="chart__area" />
        <path d={geo.line} fill="none" stroke="var(--accent)" strokeWidth={compact ? 1.6 : 2} strokeLinecap="round" vectorEffect="non-scaling-stroke" className="chart__line" pathLength={1} />
        {target !== undefined && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={geo.y(target)} y2={geo.y(target)} stroke="var(--success)" strokeWidth="1.2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
          </g>
        )}
        {hover !== null && (
          <line x1={geo.pts[hover][0]} x2={geo.pts[hover][0]} y1={pad.t} y2={H - pad.b} stroke="var(--border-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* Points and labels as HTML so they stay round and crisp at any aspect ratio. */}
      <span className="chart__dot chart__dot--now" style={{ left: `${(last[0] / W) * 100}%`, top: last[1] }} />
      {hover !== null && <span className="chart__dot" style={{ left: `${(geo.pts[hover][0] / W) * 100}%`, top: geo.pts[hover][1] }} />}
      {!compact && target !== undefined && (
        <span className="chart__label chart__label--target num" style={{ top: geo.y(target) }}>
          Target {fmt(target)}
        </span>
      )}
      {!compact && (
        <span className="chart__label chart__label--now num" style={{ top: last[1] }}>
          {fmt(current.price)}
        </span>
      )}
      {!compact && (
        <div className="chart__axis">
          <span>{fmtDay(first.at)}</span>
          <span>{fmtDay(current.at)}</span>
        </div>
      )}
      {h && (
        <div className="chart__tip num" style={{ left: `${(geo.pts[hover!][0] / W) * 100}%` }}>
          <b>{fmt(h.price)}</b>
          <span>
            {fmtDay(h.at)} · {h.simulated ? "simulated" : "live"}
          </span>
        </div>
      )}
    </div>
  );
}
