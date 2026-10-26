"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { addDays, cx } from "@/lib/utils";

/**
 * A real date picker: month grids, a departure and an optional return with the days between them
 * highlighted, past and out-of-range days disabled, and full keyboard support (arrows, Page Up/Down,
 * Home/End, Enter). It shows no prices: the flight provider has no per-day fares to show.
 */

type Props = {
  mode: "range" | "single";
  start?: string;
  end?: string;
  min: string;
  max: string;
  /** Range mode: which end the next click sets. */
  picking?: "start" | "end";
  onChange: (start: string | undefined, end: string | undefined) => void;
  /** YYYY-MM to open on. */
  month?: string;
  locale: "en" | "fr";
};

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
const addMonths = (first: string, n: number) => {
  const [y, m] = first.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};
const daysIn = (first: string) => {
  const [y, m] = first.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

function useTwoMonths() {
  const [two, setTwo] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(min-width: 720px)");
    const on = () => setTwo(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return two;
}

export function Calendar({ mode, start, end, min, max, picking, onChange, month, locale }: Props) {
  const two = useTwoMonths();
  const tag = locale === "fr" ? "fr-CA" : "en-CA";
  const firstAllowed = monthStart(min);
  const [view, setView] = useState(() => {
    const want = month ? `${month}-01` : monthStart(start ?? min);
    return want < firstAllowed ? firstAllowed : want;
  });
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState(start ?? min);
  const grid = useRef<HTMLDivElement>(null);
  const weekStartsMonday = locale === "fr";

  const months = two ? [view, addMonths(view, 1)] : [view];
  const lastAllowed = monthStart(max);
  const canPrev = view > firstAllowed;
  const canNext = addMonths(view, months.length - 1) < lastAllowed;

  const names = useMemo(() => {
    const base = Date.UTC(2024, 0, weekStartsMonday ? 1 : 7); // a Monday / a Sunday
    return Array.from({ length: 7 }, (_, i) => new Date(base + i * 86_400_000).toLocaleDateString(tag, { weekday: "narrow", timeZone: "UTC" }));
  }, [tag, weekStartsMonday]);

  const disabled = (d: string) => d < min || d > max;
  const settingEnd = mode === "range" && (picking === "end" || (start && !end && picking !== "start"));

  const pick = (d: string) => {
    if (disabled(d)) return;
    setFocus(d);
    if (mode === "single") return onChange(d, undefined);
    if (settingEnd && start && d >= start) return onChange(start, d);
    onChange(d, end && end >= d ? end : undefined);
  };

  // Keep the focused day in view and focused when it moves with the keyboard.
  const moveFocus = (d: string) => {
    const clamped = d < min ? min : d > max ? max : d;
    setFocus(clamped);
    const m = monthStart(clamped);
    if (m < view) setView(m);
    else if (m > addMonths(view, months.length - 1)) setView(addMonths(m, -(months.length - 1)));
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-day="${clamped}"]`)?.focus());
  };

  const onKey = (e: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) moveFocus(addDays(focus, step[e.key]));
    else if (e.key === "PageUp") moveFocus(addDays(focus, -30));
    else if (e.key === "PageDown") moveFocus(addDays(focus, 30));
    else if (e.key === "Home") moveFocus(addDays(focus, -((weekday(focus) - (weekStartsMonday ? 1 : 0) + 7) % 7)));
    else if (e.key === "End") moveFocus(addDays(focus, 6 - ((weekday(focus) - (weekStartsMonday ? 1 : 0) + 7) % 7)));
    else return;
    e.preventDefault();
  };

  const rangeEnd = end ?? (settingEnd && hover && start && hover > start ? hover : undefined);

  return (
    <div className="cal" ref={grid} onKeyDown={onKey}>
      <div className="cal__nav">
        <button type="button" className="icon-btn" onClick={() => setView(addMonths(view, -1))} disabled={!canPrev} aria-label={locale === "fr" ? "Mois précédent" : "Previous month"}>
          <ChevronLeft />
        </button>
        <button type="button" className="icon-btn" onClick={() => setView(addMonths(view, 1))} disabled={!canNext} aria-label={locale === "fr" ? "Mois suivant" : "Next month"}>
          <ChevronRight />
        </button>
      </div>
      <div className="cal__months">
        {months.map((m) => {
          const lead = (weekday(m) - (weekStartsMonday ? 1 : 0) + 7) % 7;
          const count = daysIn(m);
          const title = new Date(`${m}T12:00:00Z`).toLocaleDateString(tag, { month: "long", year: "numeric", timeZone: "UTC" });
          return (
            <div key={m} className="cal__month">
              <div className="cal__title" aria-live="polite">
                {title}
              </div>
              <div className="cal__grid" role="grid" aria-label={title}>
                {names.map((n, i) => (
                  <span key={i} className="cal__dow" aria-hidden="true">
                    {n}
                  </span>
                ))}
                {Array.from({ length: lead }, (_, i) => (
                  <span key={`b${i}`} />
                ))}
                {Array.from({ length: count }, (_, i) => {
                  const d = `${m.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
                  const isStart = d === start;
                  const isEnd = d === end;
                  const inRange = Boolean(start && rangeEnd && d > start && d < rangeEnd);
                  const off = disabled(d);
                  const label = new Date(`${d}T12:00:00Z`).toLocaleDateString(tag, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
                  return (
                    <button
                      key={d}
                      type="button"
                      data-day={d}
                      className={cx("cal__day", isStart && "is-start", (isEnd || (settingEnd && d === rangeEnd && !end)) && "is-end", inRange && "is-between", d === min && "is-today")}
                      disabled={off}
                      tabIndex={d === focus ? 0 : -1}
                      aria-pressed={isStart || isEnd}
                      aria-label={`${label}${isStart ? (mode === "range" ? (locale === "fr" ? ", départ" : ", departure") : "") : isEnd ? (locale === "fr" ? ", retour" : ", return") : ""}`}
                      onClick={() => pick(d)}
                      onMouseEnter={() => setHover(d)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setFocus(d)}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** "Thu, Dec 12" in the user's language. */
export function shortDate(iso: string | undefined, locale: "en" | "fr") {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export { addMonths as addCalendarMonths };
