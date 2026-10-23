import { useId } from "react";

/**
 * Pyrius mark: a lit sphere with one orbit passing behind and in front of it.
 * Colours come from the orb tokens, so the mark follows the selected orb theme.
 */
export function LogoMark({ className = "brand__mark" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={`g${id}`} cx="0.36" cy="0.3" r="0.78">
          <stop offset="0" style={{ stopColor: "var(--orb-1)" }} />
          <stop offset="0.2" style={{ stopColor: "var(--orb-2)" }} />
          <stop offset="0.58" style={{ stopColor: "var(--orb-3)" }} />
          <stop offset="1" style={{ stopColor: "var(--orb-4)" }} />
        </radialGradient>
      </defs>
      <g transform="rotate(-18 16 16)" strokeWidth="1.3" strokeLinecap="round">
        <path d="M1.5 16A14.5 5 0 0 1 30.5 16" style={{ stroke: "var(--accent-hi)" }} strokeOpacity="0.35" />
      </g>
      <circle cx="16" cy="16" r="9.25" fill={`url(#g${id})`} />
      <g transform="rotate(-18 16 16)" strokeWidth="1.3" strokeLinecap="round">
        <path d="M1.5 16A14.5 5 0 0 0 30.5 16" style={{ stroke: "var(--orb-2)" }} />
        <circle cx="27.9" cy="18.87" r="1.6" style={{ fill: "var(--orb-1)" }} stroke="none" />
      </g>
    </svg>
  );
}
