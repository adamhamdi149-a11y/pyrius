"use client";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, MapPin, Minus, Plane, Plus, Search, Users } from "lucide-react";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AIRPORTS } from "@/lib/data/catalog";
import type { Airport } from "@/lib/types";
import { addDays, cx, parseDate, toISODate } from "@/lib/utils";
import type { FragKey } from "./scripts";

/* The old search form, in pieces, and every piece works: the "before" a visitor can try. */

type Cabin = "Economy" | "Premium" | "Business" | "First";
type Stops = "0" | "1" | "2" | null;
type Sort = "recommended" | "cheapest" | "fastest";

interface Filters {
  to: Airport | null;
  from: Airport | null;
  start: string | null;
  end: string | null;
  /** Trip length chosen before any dates. */
  nights: number | null;
  flex: boolean;
  adults: number;
  children: number;
  cabin: Cabin;
  stops: Stops;
  budget: number;
  sort: Sort;
  tabs: string[];
  tab: number;
}

const INITIAL: Filters = {
  to: null,
  from: null,
  start: null,
  end: null,
  nights: null,
  flex: false,
  adults: 1,
  children: 0,
  cabin: "Economy",
  stops: null,
  budget: 1500,
  sort: "recommended",
  tabs: ["Flights · results", "Compare (3)", "Flights · new dates"],
  tab: 0,
};

const MORE_TABS = ["Hotels", "Car rental", "Flights · again", "Compare (4)"];

const Ctx = createContext<{ f: Filters; set: (p: Partial<Filters>) => void; today: string | null } | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [f, setF] = useState(INITIAL);
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(toISODate(new Date())), []);
  const value = useMemo(() => ({ f, set: (p: Partial<Filters>) => setF((s) => ({ ...s, ...p })), today }), [f, today]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const useFilters = () => useContext(Ctx)!;

const nightsBetween = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 864e5);
const short = (iso: string) => parseDate(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

export function FragmentView({ k }: { k: FragKey }) {
  switch (k) {
    case "to":
      return <AirportField label="To" icon={<MapPin />} placeholder="City or airport" field="to" />;
    case "from":
      return <AirportField label="From" icon={<Plane />} placeholder="Departure airport" field="from" />;
    case "dates":
      return <DatesField />;
    case "length":
      return <LengthField />;
    case "flex":
      return <FlexField />;
    case "pax":
      return <TravelersField />;
    case "budget":
      return <BudgetField />;
    case "stops":
      return <StopsField />;
    case "sort":
      return <SortField />;
    case "tabs":
      return <TabsField />;
  }
}

/* ---------- To / From ---------- */

function AirportField({ label, icon, placeholder, field }: { label: string; icon: ReactNode; placeholder: string; field: "to" | "from" }) {
  const { f, set } = useFilters();
  const picked = f[field];
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const id = useId();

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    const pool = q ? AIRPORTS.filter((a) => a.city.toLowerCase().startsWith(q) || a.code.toLowerCase().startsWith(q) || a.country.toLowerCase().startsWith(q)) : AIRPORTS;
    return pool.slice(0, 5);
  }, [text]);

  const choose = (a: Airport) => {
    set({ [field]: a } as Partial<Filters>);
    setText(`${a.city} (${a.code})`);
    setOpen(false);
  };

  return (
    <div className="ff ff--field">
      <label className="ff__label" htmlFor={id}>
        {label}
      </label>
      <span className="ff__input">
        {icon}
        <input
          id={id}
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          onBlur={() => {
            setOpen(false);
            if (picked) setText(`${picked.city} (${picked.code})`);
          }}
          onChange={(e) => {
            setText(e.target.value);
            setHi(0);
            setOpen(true);
            if (picked) set({ [field]: null } as Partial<Filters>);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(h + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && open && matches[hi]) {
              e.preventDefault();
              choose(matches[hi]);
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
      </span>
      {open && matches.length > 0 && (
        <ul className="ff__menu" id={`${id}-list`} role="listbox" aria-label={`${label} airports`}>
          {matches.map((a, i) => (
            <li
              key={a.code}
              role="option"
              aria-selected={i === hi}
              data-hi={i === hi}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHi(i)}
              onClick={() => choose(a)}
            >
              <b>{a.code}</b>
              <span>
                {a.city}, {a.country}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Depart — Return ---------- */

const WEEK = ["S", "M", "T", "W", "T", "F", "S"];

function DatesField() {
  const { f, set, today } = useFilters();
  const [month, setMonth] = useState<string | null>(null); // YYYY-MM-01

  useEffect(() => {
    if (today && !month) setMonth(`${today.slice(0, 7)}-01`);
  }, [today, month]);

  const first = month ? parseDate(month) : null;
  const days = useMemo(() => {
    if (!first) return [];
    const lead = first.getDay();
    const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => toISODate(new Date(first.getFullYear(), first.getMonth(), i + 1)))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const shift = (n: number) => {
    if (!first) return;
    setMonth(toISODate(new Date(first.getFullYear(), first.getMonth() + n, 1)));
  };

  const pickDay = (d: string) => {
    if (!f.start || f.end || d <= f.start) {
      set({ start: d, end: f.nights ? addDays(d, f.nights) : null });
      return;
    }
    set({ end: d, nights: null });
  };

  const canBack = Boolean(first && today && month! > `${today.slice(0, 7)}-01`);
  const title = first?.toLocaleDateString("en-CA", { month: "long", year: "numeric" }) ?? "";
  const summary = f.start ? `${short(f.start)} → ${f.end ? short(f.end) : "…"}` : null;

  return (
    <div className="ff ff--cal">
      <span className="ff__label">
        <Calendar /> {summary ? <span className="ff__on">{summary}</span> : "Depart — Return"}
      </span>
      <div className="ff__month">
        <button type="button" aria-label="Previous month" disabled={!canBack} onClick={() => shift(-1)}>
          <ChevronLeft />
        </button>
        <span aria-live="polite">{title}</span>
        <button type="button" aria-label="Next month" onClick={() => shift(1)}>
          <ChevronRight />
        </button>
      </div>
      <div className="ff__grid" role="group" aria-label={title}>
        {WEEK.map((w, i) => (
          <span key={`w${i}`} className="ff__dow" aria-hidden="true">
            {w}
          </span>
        ))}
        {/* Always six weeks, so the box keeps one size whatever the month. */}
        {Array.from({ length: 42 }, (_, i) => days[i] ?? null).map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              className="ff__day"
              disabled={Boolean(today && d < today)}
              data-edge={d === f.start || d === f.end}
              data-in={Boolean(f.start && f.end && d > f.start && d < f.end)}
              aria-pressed={d === f.start || d === f.end}
              aria-label={parseDate(d).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
              onClick={() => pickDay(d)}
            >
              {Number(d.slice(8))}
            </button>
          ) : (
            <span key={`b${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

/* ---------- Trip length (shares state with the calendar) ---------- */

function LengthField() {
  const { f, set } = useFilters();
  const n = f.start && f.end ? nightsBetween(f.start, f.end) : f.nights;
  const step = (d: number) => {
    const next = Math.min(30, Math.max(1, (n ?? 6) + d));
    if (f.start) set({ end: addDays(f.start, next), nights: null });
    else set({ nights: next });
  };
  return (
    <div className="ff ff--row">
      <span className="ff__label">Trip length</span>
      <span className="ff__stepper">
        <button type="button" aria-label="Fewer nights" onClick={() => step(-1)} disabled={n === 1}>
          <Minus />
        </button>
        <b aria-live="polite">{n ? `${n} night${n === 1 ? "" : "s"}` : "— nights"}</b>
        <button type="button" aria-label="More nights" onClick={() => step(1)} disabled={n === 30}>
          <Plus />
        </button>
      </span>
    </div>
  );
}

/* ---------- Flexible dates ---------- */

function FlexField() {
  const { f, set } = useFilters();
  return (
    <button type="button" className="ff ff--row ff--toggle" role="switch" aria-checked={f.flex} onClick={() => set({ flex: !f.flex })}>
      <span className="ff__label">Flexible dates ± 3 days</span>
      <i className="ff__switch" data-on={f.flex} />
    </button>
  );
}

/* ---------- Travelers & class ---------- */

const CABINS: Cabin[] = ["Economy", "Premium", "Business", "First"];

function TravelersField() {
  const { f, set } = useFilters();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const people = `${f.adults} adult${f.adults === 1 ? "" : "s"}${f.children ? `, ${f.children} child${f.children === 1 ? "" : "ren"}` : ""}`;

  return (
    <div className="ff ff--field" ref={box}>
      <span className="ff__label">Travelers &amp; class</span>
      <button type="button" className="ff__input ff__input--btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Users />
        <span>
          {people}, {f.cabin}
        </span>
        <ChevronDown />
      </button>
      {open && (
        <div className="ff__pop" id={id} role="dialog" aria-label="Travelers and class">
          <Counter label="Adults" value={f.adults} min={1} max={9} onChange={(v) => set({ adults: v })} />
          <Counter label="Children" value={f.children} min={0} max={8} onChange={(v) => set({ children: v })} />
          <div className="ff__seg" role="radiogroup" aria-label="Cabin">
            {CABINS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={f.cabin === c} onClick={() => set({ cabin: c })}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="ff__count">
      <span>{label}</span>
      <span className="ff__stepper">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus />
        </button>
        <b aria-live="polite">{value}</b>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Plus />
        </button>
      </span>
    </div>
  );
}

/* ---------- Max price ---------- */

function BudgetField() {
  const { f, set } = useFilters();
  const id = useId();
  const min = 200;
  const max = 3000;
  return (
    <div className="ff ff--range">
      <label className="ff__label" htmlFor={id}>
        Max price <span className="ff__on">${f.budget.toLocaleString("en-CA")}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={50}
        value={f.budget}
        style={{ ["--p" as string]: `${((f.budget - min) / (max - min)) * 100}%` }}
        onChange={(e) => set({ budget: Number(e.target.value) })}
      />
    </div>
  );
}

/* ---------- Stops ---------- */

function StopsField() {
  const { f, set } = useFilters();
  const opts: [Exclude<Stops, null>, string][] = [
    ["0", "Nonstop"],
    ["1", "1 stop"],
    ["2", "2+"],
  ];
  return (
    <div className="ff ff--chips">
      <span className="ff__label">Stops</span>
      <span role="group" aria-label="Stops">
        {opts.map(([v, l]) => (
          <button key={v} type="button" aria-pressed={f.stops === v} onClick={() => set({ stops: f.stops === v ? null : v })}>
            {l}
          </button>
        ))}
      </span>
    </div>
  );
}

/* ---------- Sort ---------- */

function SortField() {
  const { f, set } = useFilters();
  const id = useId();
  return (
    <div className="ff ff--row">
      <label className="ff__label" htmlFor={id}>
        Sort by
      </label>
      <span className="ff__select">
        <select id={id} value={f.sort} onChange={(e) => set({ sort: e.target.value as Sort })}>
          <option value="recommended">Recommended</option>
          <option value="cheapest">Cheapest</option>
          <option value="fastest">Fastest</option>
        </select>
        <ChevronDown />
      </span>
    </div>
  );
}

/* ---------- Tabs ---------- */

function TabsField() {
  const { f, set } = useFilters();
  const full = f.tabs.length >= 3 + MORE_TABS.length;
  return (
    <div className="ff ff--tabs" role="tablist" aria-label="Search tabs">
      {f.tabs.map((t, i) => (
        <button key={`${t}${i}`} type="button" role="tab" aria-selected={f.tab === i} className={cx(f.tab === i && "is-on")} onClick={() => set({ tab: i })}>
          {i === 0 && <Search />} {t}
        </button>
      ))}
      <button
        type="button"
        className="ff__add"
        aria-label="Open another tab"
        title={full ? "That's plenty of tabs" : "Open another tab"}
        disabled={full}
        onClick={() => set({ tabs: [...f.tabs, MORE_TABS[f.tabs.length - 3]], tab: f.tabs.length })}
      >
        <Plus />
      </button>
    </div>
  );
}
