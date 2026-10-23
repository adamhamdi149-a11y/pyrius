"use client";
import { AlertCircle, ArrowRight, Building2, Car, Compass, Home, Hotel, KeyRound, LayoutDashboard, LineChart, Plane, RotateCcw, SkipForward, SlidersHorizontal, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Orb } from "@/components/ai/Orb";
import type { Chip, ChatMessage } from "@/lib/types";

/** Reveals text progressively (word groups), then signals completion so chips/results can appear. */
export function useTypewriter(text: string, active: boolean, onDone?: () => void) {
  const [n, setN] = useState(active ? 0 : text.length);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!active) {
      setN(text.length);
      return;
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setN(text.length);
      done.current?.();
      return;
    }
    let i = 0;
    const step = Math.max(2, Math.round(text.length / 90));
    const id = setInterval(() => {
      i = Math.min(text.length, i + step);
      // Advance to the next word boundary so words never appear half-typed.
      while (i < text.length && !/\s/.test(text[i])) i++;
      setN(i);
      if (i >= text.length) {
        clearInterval(id);
        done.current?.();
      }
    }, 22);
    return () => clearInterval(id);
  }, [text, active]);
  return text.slice(0, n);
}

function chipIcon(c: Chip) {
  const a = c.action;
  if (a.type === "hotels") return a.stayType === "apartment" ? <Home /> : <Hotel />;
  if (a.type === "cars") return a.mode === "dealerships" ? <Building2 /> : a.mode === "agencies" ? <KeyRound /> : <Car />;
  if (a.type === "skip-hotels" || a.type === "skip-cars") return <SkipForward />;
  if (a.type === "navigate") return a.href.includes("tracking") ? <LineChart /> : <LayoutDashboard />;
  const t = c.label.toLowerCase();
  if (/warm|chaud|sun/.test(t)) return <Sun />;
  if (/nonstop|direct|connection|escale/.test(t)) return <Plane />;
  if (/date/.test(t)) return <Compass />;
  if (/cheap|moins cher|budget/.test(t)) return <SlidersHorizontal />;
  return null;
}

export function UserMessage({ m }: { m: ChatMessage }) {
  return (
    <div className="msg msg--user">
      <div className="msg__bubble">{m.text}</div>
    </div>
  );
}

export function AssistantMessage({
  m,
  animate,
  onTyped,
  showChips,
  onChip,
  children,
}: {
  m: ChatMessage;
  animate: boolean;
  onTyped: () => void;
  showChips: boolean;
  onChip: (c: Chip) => void;
  children?: React.ReactNode;
}) {
  const [typed, setTyped] = useState(!animate);
  const text = useTypewriter(m.text, animate, () => {
    setTyped(true);
    onTyped();
  });
  return (
    <>
      <div className="msg msg--ai" id={`m-${m.id}`}>
        <div className="msg__avatar">
          <Orb size="sm" />
        </div>
        <div className="msg__content">
          <p className="msg__text">
            {text}
            {!typed && <span className="msg__caret" aria-hidden="true" />}
          </p>
          {typed && showChips && m.chips && m.chips.length > 0 && (
            <div className="msg__chips">
              {m.chips.map((c) => (
                <button key={c.label} className="chip" onClick={() => onChip(c)}>
                  {chipIcon(c)}
                  {c.label}
                  {c.action.type === "navigate" && <ArrowRight />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {typed && children && <div className="attachment">{children}</div>}
    </>
  );
}

export function Thinking({ label }: { label: string }) {
  return (
    <div className="thinking" role="status" aria-live="polite">
      <Orb size="sm" state="thinking" />
      <span className="thinking__text">{label}…</span>
    </div>
  );
}

export function ErrorRow({ text, onRetry, retryLabel }: { text: string; onRetry: () => void; retryLabel: string }) {
  return (
    <div className="msg msg--ai">
      <div className="msg__avatar">
        <Orb size="sm" />
      </div>
      <div className="msg__content">
        <div className="msg__error">
          <AlertCircle style={{ width: 16, height: 16 }} />
          {text}
          <button className="btn btn--secondary btn--sm" onClick={onRetry}>
            <RotateCcw />
            {retryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
