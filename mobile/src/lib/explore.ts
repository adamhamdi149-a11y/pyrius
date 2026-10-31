import { useCallback, useMemo } from "react";
import { destinationById } from "@/lib/explore/destinations";
import { characteristics, personalityFor, profileFrom, recommend, SKIP, type Answers } from "@/lib/explore/engine";
import { QUESTIONS } from "@/lib/explore/questions";
import type { ExploreState } from "@/lib/types";
import { useStore } from "./store";

const EMPTY: ExploreState = { answers: {} };
const MAX_HISTORY = 12;

/**
 * Explore's state, kept in the user's settings so it follows them to every device and can inform
 * future recommendations: the current answers, past discoveries and saved destinations.
 */
export function useExplore() {
  const { settings, updateSettings } = useStore();
  const state = settings.explore ?? EMPTY;
  const answers = state.answers;

  const write = useCallback((patch: Partial<ExploreState>) => updateSettings({ explore: { ...(settings.explore ?? EMPTY), ...patch } }), [settings.explore, updateSettings]);

  const profile = useMemo(() => profileFrom(answers), [answers]);
  const personality = useMemo(() => personalityFor(profile), [profile]);
  const traits = useMemo(() => characteristics(profile), [profile]);
  const done = QUESTIONS.every((q) => q.id in answers);

  return {
    answers,
    profile,
    personality,
    traits,
    done,
    history: state.history ?? [],
    saved: state.saved ?? [],
    setAnswer: (questionId: string, optionId: string) => write({ answers: { ...answers, [questionId]: optionId } }),
    skip: (questionId: string) => write({ answers: { ...answers, [questionId]: SKIP } }),
    /** Clears the answers for a new discovery; saved destinations and history stay. */
    startOver: () => write({ answers: {} }),
    /** Records a finished discovery (once per set of answers). */
    finish: (answersNow: Answers) => {
      const p = profileFrom(answersNow);
      const recs = recommend(p);
      if (!recs.length) return;
      const entry = { personality: personalityFor(p).id, destinations: recs.map((r) => r.destination.id), at: new Date().toISOString() };
      const last = state.history?.[0];
      if (last && last.personality === entry.personality && last.destinations.join() === entry.destinations.join()) return;
      write({ answers: answersNow, history: [entry, ...(state.history ?? [])].slice(0, MAX_HISTORY) });
    },
    isSaved: (id: string) => (state.saved ?? []).includes(id),
    toggleSaved: (id: string) => {
      const list = state.saved ?? [];
      write({ saved: list.includes(id) ? list.filter((x) => x !== id) : [id, ...list] });
    },
    savedDestinations: () => (state.saved ?? []).map(destinationById).filter((d) => d !== undefined),
  };
}
