"use client";
import { FlaskConical, ImageOff } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/utils";

/** Image with a calm fade-in, fixed aspect (no layout shift) and an honest fallback if it fails. */
export function SmartImage({ src, alt, className, ratio, sizes }: { src: string; alt: string; className?: string; ratio?: string; sizes?: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth) setState("loaded");
  }, [src]);
  return (
    <div className={cx("img", className)} style={ratio ? { aspectRatio: ratio } : undefined}>
      {state !== "error" && (
        <img
          ref={ref}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          sizes={sizes}
          data-loaded={state === "loaded"}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
        />
      )}
      {state === "error" && (
        <div className="img__fallback" role="img" aria-label={alt}>
          <ImageOff />
        </div>
      )}
    </div>
  );
}

export function DemoBadge({ label = "Demo data", title }: { label?: string; title?: string }) {
  return (
    <span className="badge badge--demo" title={title ?? "Illustrative data for testing — not live prices or availability."}>
      <FlaskConical />
      {label}
    </span>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__art">{icon}</div>
      <div className="empty__title">{title}</div>
      {body && <div className="empty__body">{body}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ w, h, r, style }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Closes a popover on outside click / Escape. */
export function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
}

export function initials(name: string, email?: string) {
  const src = name.trim() || email?.split("@")[0] || "";
  if (!src) return "P";
  const parts = src.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "P";
}
