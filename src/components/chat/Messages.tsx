"use client";
import { AlertCircle, ArrowRight, Building2, Car, Compass, Home, Hotel, KeyRound, LayoutDashboard, LineChart, Plane, RotateCcw, SkipForward, SlidersHorizontal, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Orb } from "@/components/ai/Orb";
import { prefersReducedMotion, stagger } from "@/lib/motion";
import type { Chip, ChatMessage } from "@/lib/types";

const WORD_STEP = 16; // ms between words
const WORD_FADE = 320; // ms each word takes to settle

/**
 * Reveals an answer word by word with a soft blur-in, then reports completion
 * so chips and results appear only after the sentence has landed.
 */
function StreamText({ text, animate, onDone }: { text: string; animate: boolean; onDone: () => void }) {
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const done = useRef(onDone);
  done.current = onDone;
  const [live] = useState(() => animate && !prefersReducedMotion());

  useEffect(() => {
    if (!live) {
      done.current();
      return;
    }
    const count = words.filter((w) => w.trim()).length;
    const id = setTimeout(() => done.current(), Math.min(count * WORD_STEP, 2200) + WORD_FADE);
    return () => clearTimeout(id);
  }, [live, words]);

  if (!live) return <>{text}</>;
  let i = 0;
  return (
    <>
      {words.map((w, k) =>
        w.trim() ? (
          <span key={k} className="word" style={{ animationDelay: `${Math.min(i++ * WORD_STEP, 2200)}ms` }}>
            {w}
          </span>
        ) : (
          w
        ),
      )}
    </>
  );
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
  return (
    <>
      <div className="msg msg--ai" id={`m-${m.id}`} data-live={animate}>
        <div className="msg__avatar">
          <Orb size="sm" />
        </div>
        <div className="msg__content">
          <p className="msg__text">
            <StreamText
              text={m.text}
              animate={animate}
              onDone={() => {
                setTyped(true);
                if (animate) onTyped();
              }}
            />
          </p>
          {typed && showChips && m.chips && m.chips.length > 0 && (
            <div className="msg__chips m-stagger">
              {m.chips.map((c, i) => (
                <button key={c.label} className="chip m-press" style={stagger(i)} onClick={() => onChip(c)}>
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

/** Shown only while a real request to the assistant is in flight. */
export function Thinking({ label, slowLabel }: { label: string; slowLabel: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="thinking" role="status" aria-live="polite">
      <span className="thinking__dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="thinking__text">{slow ? slowLabel : label}</span>
    </div>
  );
}

export function ErrorRow({ text, hint, onRetry, retryLabel }: { text: string; hint: string; onRetry: () => void; retryLabel: string }) {
  return (
    <div className="msg msg--ai msg--error" role="alert">
      <div className="msg__avatar">
        <span className="msg__erricon">
          <AlertCircle />
        </span>
      </div>
      <div className="msg__content">
        <div className="msg__errcard">
          <div>
            <div className="msg__errtitle">{text}</div>
            <div className="msg__errhint">{hint}</div>
          </div>
          <button className="btn btn--secondary btn--sm m-press" onClick={onRetry}>
            <RotateCcw />
            {retryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
