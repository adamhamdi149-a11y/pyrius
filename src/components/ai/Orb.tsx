import { cx } from "@/lib/utils";

export type OrbState = "idle" | "thinking" | "listening";

/** The Pyrius presence: layered gradients, slow inner flow and two tilted orbits. Pure CSS, no canvas. */
export function Orb({ state = "idle", size = "lg", className }: { state?: OrbState; size?: "lg" | "sm"; className?: string }) {
  return (
    <div className={cx("orb", size === "sm" && "orb--sm", className)} data-state={state} aria-hidden="true">
      <div className="orb__halo" />
      {size === "lg" && (
        <>
          <div className="orb__ring orb__ring--b">
            <div className="orb__sat" />
          </div>
          <div className="orb__ring">
            <div className="orb__sat" />
          </div>
        </>
      )}
      <div className="orb__body">
        <div className="orb__flow" />
        <div className="orb__flow orb__flow--b" />
        {size === "lg" && <div className="orb__grain" />}
        <div className="orb__shade" />
        <div className="orb__sheen" />
      </div>
    </div>
  );
}
