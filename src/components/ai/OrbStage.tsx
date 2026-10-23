"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { DURATION, type OrbMood } from "@/lib/motion";
import { LiveOrb } from "./LiveOrb";

/** Canvas box size in CSS px. The sphere is 56% of it (shader constant R). */
const STAGE = 300;
const SPHERE = 0.56;

/**
 * One persistent orb that flies between anchors: the large welcome position and
 * the small slot inside the composer. Keeping a single canvas means the move from
 * welcome into conversation is a continuous motion, not a swap.
 */
export function OrbStage({ mood, pulseKey, anchor, anchorKey }: { mood: OrbMood; pulseKey: number; anchor: RefObject<HTMLElement | null>; anchorKey: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [flying, setFlying] = useState(false);
  const [ready, setReady] = useState(false);
  const firstKey = useRef(anchorKey);

  // Fly when the anchor changes (but not on first paint).
  useEffect(() => {
    if (anchorKey === firstKey.current) return;
    firstKey.current = anchorKey;
    setFlying(true);
    const id = setTimeout(() => setFlying(false), DURATION.orbFlight + 60);
    return () => clearTimeout(id);
  }, [anchorKey]);

  // Follow the anchor every frame; cheap (two rect reads) and robust to any layout shift.
  useEffect(() => {
    let raf = 0;
    let lastT = "";
    const tick = () => {
      const s = stage.current;
      const a = anchor.current;
      const host = s?.parentElement;
      if (s && a && host) {
        const ar = a.getBoundingClientRect();
        const hr = host.getBoundingClientRect();
        // Size from the anchor's height: the composer slot animates its width open.
        if (ar.height > 0) {
          const k = ar.height / (SPHERE * STAGE);
          const x = ar.left - hr.left + ar.width / 2 - STAGE / 2;
          const y = ar.top - hr.top + ar.height / 2 - STAGE / 2;
          const t = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${k.toFixed(4)})`;
          if (t !== lastT) {
            s.style.transform = t;
            lastT = t;
            setScale((prev) => (Math.abs(prev - k) > 0.02 ? k : prev));
          }
          if (!ready) setReady(true);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anchor, ready]);

  return (
    <div ref={stage} className="orb-stage" data-anchor={anchorKey} data-flying={flying} data-ready={ready} style={{ width: STAGE, height: STAGE }} aria-hidden="true">
      <div className="orb-stage__inner">
        {/* Keep the buffer large while flying so the orb stays crisp mid-flight. */}
        <LiveOrb mood={mood} pulseKey={pulseKey} displayScale={flying ? Math.max(scale, 0.6) : scale} interactive />
      </div>
    </div>
  );
}
