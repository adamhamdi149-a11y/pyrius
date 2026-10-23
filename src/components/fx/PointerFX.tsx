"use client";
import { useEffect, useRef } from "react";
import { finePointer, prefersReducedMotion } from "@/lib/motion";

/**
 * Desktop-only pointer effects, all driven by CSS variables (no re-renders):
 * - an ambient amber light that follows the pointer behind the content
 * - --gx/--gy on the hovered [data-glow] card for a local spotlight + border light
 * - --pxn/--pyn (-1..1) on <html> for gentle parallax of background elements
 * Never changes the cursor, never intercepts events, and stays off on touch
 * devices or when reduced motion is requested.
 */
export function PointerFX() {
  const light = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!finePointer() || prefersReducedMotion()) return;
    const root = document.documentElement;
    let raf = 0;
    let e: PointerEvent | null = null;

    const apply = () => {
      raf = 0;
      if (!e) return;
      const l = light.current;
      if (l) {
        const r = l.getBoundingClientRect();
        l.style.setProperty("--mx", `${e.clientX - r.left}px`);
        l.style.setProperty("--my", `${e.clientY - r.top}px`);
        l.dataset.on = "true";
      }
      root.style.setProperty("--pxn", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
      root.style.setProperty("--pyn", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      const target = (e.target as Element | null)?.closest?.("[data-glow]") as HTMLElement | null;
      if (target) {
        const r = target.getBoundingClientRect();
        target.style.setProperty("--gx", `${e.clientX - r.left}px`);
        target.style.setProperty("--gy", `${e.clientY - r.top}px`);
      }
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;
      e = ev;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      if (light.current) light.current.dataset.on = "false";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return <div ref={light} className="pointer-light" aria-hidden="true" />;
}
