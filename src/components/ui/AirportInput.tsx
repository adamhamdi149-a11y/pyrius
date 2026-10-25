"use client";
import { useId, useMemo, useRef, useState } from "react";
import { findAirport, searchAirports } from "@/lib/data/world";

/** Pick any airport in the world by city, country or code. Shows "City (CODE)" once chosen. */
export function AirportInput({ value, onChange, id, placeholder = "City or airport" }: { value: string; onChange: (code: string) => void; id?: string; placeholder?: string }) {
  const auto = useId();
  const inputId = id ?? auto;
  const listId = `${inputId}-list`;
  const chosen = findAirport(value);
  const label = chosen ? `${chosen.city} (${chosen.code})` : value;
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const blur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const results = useMemo(() => (query ? searchAirports(query, 8) : []), [query]);
  const open = query !== null && results.length > 0;

  const pick = (code: string) => {
    onChange(code);
    setQuery(null);
  };

  return (
    <div className="ap">
      <input
        id={inputId}
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={query ?? label}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") e.preventDefault(), setActive((i) => Math.min(i + 1, results.length - 1));
          else if (e.key === "ArrowUp") e.preventDefault(), setActive((i) => Math.max(i - 1, 0));
          else if (e.key === "Enter") e.preventDefault(), pick(results[active].code);
          else if (e.key === "Escape") setQuery(null);
        }}
        onBlur={() => {
          blur.current = setTimeout(() => setQuery(null), 120);
        }}
      />
      {open && (
        <ul className="popover ap__list" id={listId} role="listbox">
          {results.map((a, i) => (
            <li key={a.code} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                className="menu-item"
                data-active={i === active}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(a.code)}
              >
                <span className="ap__city">
                  {a.city}
                  <small>{a.country}</small>
                </span>
                <b className="ap__code">{a.code}</b>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
