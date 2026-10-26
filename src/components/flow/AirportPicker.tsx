"use client";
import { Home, Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { countryNamed, findAirport, nearestAirports, searchAirports, type WorldAirport } from "@/lib/data/world";
import { cx } from "@/lib/utils";

/**
 * Inline airport search for the conversation: city, airport name, IATA code or country, matched
 * against the real airport table (nothing is invented or silently picked). A city with several
 * airports lists each one; a country lists its airports. The user's location is only read when
 * they tap "Near me", through the browser's own permission prompt.
 */

type Props = {
  role: "origin" | "destination";
  locale: "en" | "fr";
  onPick: (code: string) => void;
  /** A place the user typed or said that isn't one airport yet ("Japan"). */
  initialQuery?: string;
  /** Codes that can't be picked here (the other end of the trip). */
  exclude?: string[];
  homeCode?: string;
  autoFocus?: boolean;
  compact?: boolean;
};

type Loc = { state: "idle" } | { state: "locating" } | { state: "done"; list: { a: WorldAirport; km: number }[] } | { state: "error"; message: string };

export function AirportPicker({ role, locale, onPick, initialQuery = "", exclude = [], homeCode, autoFocus, compact }: Props) {
  const fr = locale === "fr";
  const id = useId();
  const [q, setQ] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const [loc, setLoc] = useState<Loc>({ state: "idle" });
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && matchMedia("(hover: hover)").matches) input.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const country = useMemo(() => countryNamed(q), [q]);
  const results = useMemo(() => (q.trim() ? searchAirports(q, country ? 10 : 7).filter((a) => !exclude.includes(a.code)) : []), [q, country, exclude]);
  const home = homeCode && !exclude.includes(homeCode) ? findAirport(homeCode) : undefined;
  const suggestions: { a: WorldAirport; note: string; icon: "home" | "near" }[] = !q.trim()
    ? [
        ...(role === "origin" && home ? [{ a: home, note: fr ? "Votre aéroport" : "Your home airport", icon: "home" as const }] : []),
        ...(loc.state === "done" ? loc.list.filter((x) => !exclude.includes(x.a.code) && x.a.code !== home?.code).map((x) => ({ a: x.a, note: `${x.km} km`, icon: "near" as const })) : []),
      ]
    : [];
  const list = q.trim() ? results.map((a) => ({ a, note: "", icon: undefined })) : suggestions;

  const choose = (a: WorldAirport) => {
    setQ("");
    onPick(a.code);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) return setLoc({ state: "error", message: fr ? "La localisation n'est pas disponible ici." : "Location isn't available in this browser." });
    setLoc({ state: "locating" });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        // A rough fix (over 25 km) isn't good enough to suggest airports from.
        if (p.coords.accuracy > 25_000) return setLoc({ state: "error", message: fr ? "Votre position est trop imprécise. Cherchez votre ville." : "Your location isn't precise enough. Search for your city instead." });
        const near = nearestAirports(p.coords.latitude, p.coords.longitude, 4);
        setLoc(near.length ? { state: "done", list: near } : { state: "error", message: fr ? "Aucun aéroport proche trouvé. Cherchez votre ville." : "No airport with scheduled flights nearby. Search for your city instead." });
      },
      () => setLoc({ state: "error", message: fr ? "Localisation refusée. Cherchez votre ville." : "Location wasn't shared. Search for your city instead." }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") (e.preventDefault(), setActive((i) => Math.min(i + 1, list.length - 1)));
    else if (e.key === "ArrowUp") (e.preventDefault(), setActive((i) => Math.max(i - 1, 0)));
    else if (e.key === "Enter" && list[active]) (e.preventDefault(), choose(list[active].a));
    else if (e.key === "Escape") setQ("");
  };

  const label = role === "origin" ? (fr ? "Départ" : "Flying from") : fr ? "Destination" : "Flying to";
  const placeholder = role === "origin" ? (fr ? "Ville, aéroport ou code" : "City, airport or code") : fr ? "Ville, aéroport, code ou pays" : "City, airport, code or country";

  return (
    <div className={cx("ap2", compact && "ap2--compact")}>
      <label className="ap2__field" htmlFor={id}>
        <Search aria-hidden="true" />
        <span className="sr-only">{label}</span>
        <input
          ref={input}
          id={id}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={list.length > 0}
          aria-controls={`${id}-list`}
          aria-activedescendant={list[active] ? `${id}-${list[active].a.code}` : undefined}
        />
        {q && (
          <button type="button" className="ap2__clear" onClick={() => (setQ(""), input.current?.focus())} aria-label={fr ? "Effacer" : "Clear"}>
            <X />
          </button>
        )}
      </label>

      {country && q.trim() && <p className="ap2__hint">{fr ? `${country} a plusieurs aéroports : choisissez votre ville.` : `${country} has several airports — pick your city.`}</p>}

      {list.length > 0 && (
        <ul className="ap2__list" id={`${id}-list`} role="listbox" aria-label={label}>
          {list.map(({ a, note, icon }, i) => (
            <li key={a.code} id={`${id}-${a.code}`} role="option" aria-selected={i === active}>
              <button type="button" className="ap2__row" data-active={i === active} onMouseEnter={() => setActive(i)} onClick={() => choose(a)}>
                <span className="ap2__icon" aria-hidden="true">
                  {icon === "home" ? <Home /> : icon === "near" ? <LocateFixed /> : <MapPin />}
                </span>
                <span className="ap2__text">
                  <b>
                    {a.city}
                    <span>, {a.country}</span>
                  </b>
                  <small>{note ? `${a.name} · ${note}` : a.name}</small>
                </span>
                <span className="ap2__code">{a.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {q.trim() && !list.length && (
        <p className="ap2__empty" role="status">
          {fr ? `Aucun aéroport avec des vols réguliers ne correspond à « ${q.trim()} ». Essayez une ville ou un code.` : `No airport with scheduled flights matches “${q.trim()}”. Try a city or a code.`}
        </p>
      )}

      {!q.trim() && role === "origin" && loc.state !== "done" && (
        <button type="button" className="ap2__locate" onClick={locate} disabled={loc.state === "locating"}>
          {loc.state === "locating" ? <Loader2 className="spin" /> : <LocateFixed />}
          {loc.state === "locating" ? (fr ? "Localisation…" : "Finding airports near you…") : fr ? "Aéroports près de moi" : "Airports near me"}
        </button>
      )}
      {loc.state === "error" && (
        <p className="ap2__empty" role="status">
          {loc.message}
        </p>
      )}
    </div>
  );
}
