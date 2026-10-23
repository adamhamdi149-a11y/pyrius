"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { LiveOrb } from "@/components/ai/LiveOrb";
import { ORB_THEMES, orbThemeById, stepOrbTheme } from "@/lib/orbThemes";
import { useStore } from "@/lib/store/AppStore";

/**
 * [‹] [ Theme name ] [›] — cycles the orb colour theme with wraparound.
 * The live orb above it is the real renderer, so the change is shown, not described.
 * Selection is conveyed by name, position ("2 of 3") and dot shape, not colour alone.
 */
export function OrbThemePicker() {
  const { settings, updateSettings, ready } = useStore();
  const [dir, setDir] = useState<1 | -1>(1);
  const theme = orbThemeById(settings.orbTheme);
  const index = ORB_THEMES.findIndex((t) => t.id === theme.id);

  const go = (d: 1 | -1) => {
    setDir(d);
    updateSettings({ orbTheme: stepOrbTheme(theme.id, d) });
  };

  return (
    <div className="orbpick" data-ready={ready}>
      <div className="orbpick__stage">
        <LiveOrb mood="idle" />
      </div>

      <div
        className="orbpick__ctrl"
        role="group"
        aria-label="Orb color theme"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            go(e.key === "ArrowRight" ? 1 : -1);
          }
        }}
      >
        <button type="button" className="orbpick__arrow" aria-label="Previous orb theme" title="Previous orb theme" onClick={() => go(-1)}>
          <ChevronLeft />
        </button>
        <div className="orbpick__pill">
          <span className="orbpick__swatch" aria-hidden="true" />
          <span key={theme.id} className="orbpick__name" data-dir={dir}>
            {theme.name}
          </span>
        </div>
        <button type="button" className="orbpick__arrow" aria-label="Next orb theme" title="Next orb theme" onClick={() => go(1)}>
          <ChevronRight />
        </button>
      </div>

      <div className="orbpick__meta" aria-hidden="true">
        <span className="orbpick__dots">
          {ORB_THEMES.map((t) => (
            <i key={t.id} data-on={t.id === theme.id} />
          ))}
        </span>
        <span key={theme.id} className="orbpick__mood">
          {theme.mood} · {index + 1} of {ORB_THEMES.length}
        </span>
      </div>

      <p className="sr-only" aria-live="polite">
        {ready ? `Orb theme: ${theme.name}, ${index + 1} of ${ORB_THEMES.length}` : ""}
      </p>
    </div>
  );
}
