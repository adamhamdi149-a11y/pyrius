"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { translate, type MessageKey } from "@/lib/i18n";
import { canAddTracker, canSave, DEFAULT_SUBSCRIPTION, planById } from "@/lib/plans";
import { DEFAULT_ORB_THEME, orbThemeById } from "@/lib/orbThemes";
import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import { authHeaders } from "@/lib/authHeaders";
import { applyCheck, trackerFromOffer, type CheckResult } from "@/lib/tracking/trackers";
import type { AnyOffer, Conversation, PlanId, PriceTracker, SavedOffer, Subscription, UserSettings } from "@/lib/types";
import { uid } from "@/lib/utils";
import { LocalRepository, SupabaseRepository, type PersistedState, type Repository } from "./repository";

export const DEFAULT_SETTINGS: UserSettings = {
  name: "",
  email: "",
  homeAirport: "YUL",
  currency: "CAD",
  locale: "en",
  theme: "dark",
  orbTheme: DEFAULT_ORB_THEME,
  defaultAdults: 1,
  defaultChildren: 0,
  travelStyle: { nonstop: false, carryOnOnly: false, flexibleDates: true },
  notifications: { email: true, priceAlerts: true, savedSearches: false, productNews: false },
};

export type AuthState =
  | { mode: "local" }
  | { mode: "signed-out" } // Supabase configured, nobody signed in → local data until sign-in
  | { mode: "cloud"; userId: string; email?: string };

type Result = { ok: true } | { ok: false; reason: "limit" | "error"; message: string };

/** One "Check now": today's price, or that the offer isn't sold any more, or why it couldn't be checked. */
export type CheckOutcome = { price?: number; reached?: boolean; unavailable?: boolean; failed?: boolean; message?: string };

interface Store {
  ready: boolean;
  auth: AuthState;
  storage: "local" | "cloud";
  settings: UserSettings;
  subscription: Subscription;
  conversations: Conversation[];
  saved: SavedOffer[];
  trackers: PriceTracker[];
  activeId: string | null;
  syncError: string | null;
  t: (key: MessageKey) => string;
  setActiveId: (id: string | null) => void;
  upsertConversation: (c: Conversation) => void;
  deleteConversation: (id: string) => void;
  isSaved: (id: string) => boolean;
  saveOffer: (o: AnyOffer, conversationId?: string) => Result;
  removeSaved: (id: string) => void;
  trackerFor: (offerId: string) => PriceTracker | undefined;
  startTracking: (o: AnyOffer, target: number, conversationId?: string) => Result;
  updateTracker: (id: string, patch: Partial<Pick<PriceTracker, "targetPrice" | "status">>) => void;
  stopTracking: (id: string) => void;
  checkNow: (id: string) => Promise<CheckOutcome>;
  refreshTrackers: () => Promise<void>;
  updateSettings: (patch: Partial<UserSettings>) => void;
  setDemoPlan: (plan: PlanId) => void;
  clearLocalData: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

/** Orb theme → data-accent on <html>; accents.css maps it to the accent tokens. Mirrored for the pre-paint script. */
function applyAccent(id: UserSettings["orbTheme"]) {
  const theme = orbThemeById(id);
  document.documentElement.dataset.accent = theme.id;
  try {
    localStorage.setItem("pyrius:accent", theme.id);
  } catch {}
}

function applyTheme(theme: UserSettings["theme"]) {
  const root = document.documentElement;
  const resolved = theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  try {
    localStorage.setItem("pyrius:theme", theme);
  } catch {}
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ mode: supabaseConfigured ? "signed-out" : "local" });
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [subscription, setSubscription] = useState<Subscription>(DEFAULT_SUBSCRIPTION);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [saved, setSaved] = useState<SavedOffer[]>([]);
  const [trackers, setTrackers] = useState<PriceTracker[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const repo = useRef<Repository>(new LocalRepository());

  // Persist in the background; surface failures instead of pretending they synced.
  const persist = useCallback((fn: (r: Repository) => Promise<void>) => {
    fn(repo.current).then(
      () => setSyncError(null),
      (err: Error) => setSyncError(err.message || "Could not save your changes."),
    );
  }, []);

  const hydrate = useCallback(async (r: Repository) => {
    repo.current = r;
    const data: PersistedState = await r.load().catch((err: Error) => {
      setSyncError(err.message);
      return {};
    });
    const s = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) };
    setSettings(s);
    setConversations((data.conversations ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    // Pyrius shows only real offers now; examples saved by earlier versions stay stored but out of sight.
    setSaved((data.saved ?? []).filter((s) => s.data.offer.source !== "demo"));
    setTrackers((data.trackers ?? []).filter((t) => t.source !== "demo"));
    setSubscription(data.subscription ?? DEFAULT_SUBSCRIPTION);
    applyTheme(s.theme);
    applyAccent(s.orbTheme);
    setReady(true);
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      hydrate(new LocalRepository());
      return;
    }
    let current: string | null = null;
    const onSession = (session: { user: { id: string; email?: string } } | null) => {
      const id = session?.user.id ?? null;
      if (id === current && ready) return;
      current = id;
      if (session) {
        setAuth({ mode: "cloud", userId: session.user.id, email: session.user.email });
        hydrate(new SupabaseRepository(sb, session.user.id));
      } else {
        setAuth({ mode: "signed-out" });
        hydrate(new LocalRepository());
      }
    };
    sb.auth.getSession().then(({ data }) => onSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, session) => onSession(session));
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrate]);

  // Follow the OS theme while "system" is selected.
  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.lang = settings.locale === "fr" ? "fr-CA" : "en";
  }, [settings.locale]);

  const t = useCallback((key: MessageKey) => translate(settings.locale, key), [settings.locale]);

  const upsertConversation = useCallback(
    (c: Conversation) => {
      setConversations((list) => [c, ...list.filter((x) => x.id !== c.id)]);
      persist((r) => r.putConversation(c));
    },
    [persist],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((list) => list.filter((x) => x.id !== id));
      setActiveId((a) => (a === id ? null : a));
      persist((r) => r.removeConversation(id));
    },
    [persist],
  );

  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);
  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  const saveOffer = useCallback(
    (o: AnyOffer, conversationId?: string): Result => {
      if (savedIds.has(o.offer.id)) return { ok: true };
      if (!canSave(subscription, saved.length)) {
        return { ok: false, reason: "limit", message: `Your ${planById(subscription.plan).name} plan holds ${planById(subscription.plan).limits.saved} saved offers.` };
      }
      const item: SavedOffer = { id: o.offer.id, kind: o.kind, savedAt: new Date().toISOString(), conversationId, data: o };
      setSaved((list) => [item, ...list]);
      persist((r) => r.putSaved(item));
      return { ok: true };
    },
    [persist, saved.length, savedIds, subscription],
  );

  const removeSaved = useCallback(
    (id: string) => {
      setSaved((list) => list.filter((s) => s.id !== id));
      persist((r) => r.removeSaved(id));
      const tr = trackers.find((x) => x.offerId === id);
      if (tr) {
        setTrackers((list) => list.filter((x) => x.id !== tr.id));
        persist((r) => r.removeTracker(tr.id));
      }
    },
    [persist, trackers],
  );

  const trackerFor = useCallback((offerId: string) => trackers.find((x) => x.offerId === offerId), [trackers]);

  const startTracking = useCallback(
    (o: AnyOffer, target: number, conversationId?: string): Result => {
      const existing = trackers.find((x) => x.offerId === o.offer.id);
      if (existing) {
        const next = { ...existing, targetPrice: target, status: existing.lastKnownPrice <= target ? "target-reached" as const : "active" as const };
        setTrackers((list) => list.map((x) => (x.id === existing.id ? next : x)));
        persist((r) => r.putTracker(next));
        return { ok: true };
      }
      const active = trackers.filter((x) => x.status !== "paused").length;
      if (!canAddTracker(subscription, active)) {
        return { ok: false, reason: "limit", message: `Your ${planById(subscription.plan).name} plan tracks up to ${planById(subscription.plan).limits.trackers} prices.` };
      }
      const saveResult = saveOffer(o, conversationId);
      if (!saveResult.ok) return saveResult;
      const tr = trackerFromOffer(o, target);
      setTrackers((list) => [tr, ...list]);
      persist((r) => r.putTracker(tr));
      return { ok: true };
    },
    [persist, saveOffer, subscription, trackers],
  );

  const updateTracker = useCallback(
    (id: string, patch: Partial<Pick<PriceTracker, "targetPrice" | "status">>) => {
      const current = trackers.find((x) => x.id === id);
      if (!current) return;
      const next = { ...current, ...patch };
      if (next.status !== "paused" && (patch.targetPrice !== undefined || patch.status === "active")) {
        next.status = next.lastKnownPrice <= next.targetPrice ? "target-reached" : "active";
      }
      setTrackers((list) => list.map((x) => (x.id === id ? next : x)));
      persist((r) => r.putTracker(next));
    },
    [persist, trackers],
  );

  const stopTracking = useCallback(
    (id: string) => {
      setTrackers((list) => list.filter((x) => x.id !== id));
      persist((r) => r.removeTracker(id));
    },
    [persist],
  );

  // Looks the offer up again with its live provider and records the real price on the tracker.
  const checkNow = useCallback(
    async (id: string): Promise<CheckOutcome> => {
      const t = trackers.find((x) => x.id === id);
      const offer = saved.find((s) => s.id === t?.offerId)?.data;
      if (!t || !offer || offer.offer.source !== "live") return { failed: true, message: "This offer can't be checked." };
      try {
        const res = await fetch("/api/tracking/check", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ kind: offer.kind, offer: offer.offer }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) return { failed: true, message: body.error };
        const next = applyCheck(t, body as CheckResult);
        setTrackers((list) => list.map((x) => (x.id === id ? next : x)));
        persist((r) => r.putTracker(next));
        return body.available ? { price: next.lastKnownPrice, reached: next.status === "target-reached" } : { unavailable: true };
      } catch {
        return { failed: true };
      }
    },
    [persist, saved, trackers],
  );

  const refreshTrackers = useCallback(async () => {
    const list = await repo.current.loadTrackers?.().catch(() => null);
    if (list) setTrackers(list.filter((t) => t.source !== "demo"));
  }, []);

  // Prices checked on another device show up when the app is back in view.
  useEffect(() => {
    if (auth.mode !== "cloud") return;
    const on = () => document.visibilityState === "visible" && refreshTrackers();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [auth.mode, refreshTrackers]);

  const updateSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      const next = { ...settings, ...patch };
      if (patch.theme) applyTheme(patch.theme);
      if (patch.orbTheme) applyAccent(patch.orbTheme);
      setSettings(next);
      persist((r) => r.putSettings(next));
    },
    [persist, settings],
  );

  const setDemoPlan = useCallback((plan: PlanId) => {
    if (repo.current.mode !== "local" || !repo.current.putSubscription) return;
    const sub: Subscription = plan === "free" ? DEFAULT_SUBSCRIPTION : { plan, status: "demo-preview", source: "demo" };
    setSubscription(sub);
    repo.current.putSubscription(sub);
  }, []);

  const clearLocalData = useCallback(async () => {
    await repo.current.clear();
    if (repo.current.mode === "local") await hydrate(repo.current);
  }, [hydrate]);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  const value: Store = {
    ready,
    auth,
    storage: repo.current.mode,
    settings,
    subscription,
    conversations,
    saved,
    trackers,
    activeId,
    syncError,
    t,
    setActiveId,
    upsertConversation,
    deleteConversation,
    isSaved,
    saveOffer,
    removeSaved,
    trackerFor,
    startTracking,
    updateTracker,
    stopTracking,
    checkNow,
    refreshTrackers,
    updateSettings,
    setDemoPlan,
    clearLocalData,
    signOut,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside AppStoreProvider");
  return s;
}

export function newConversation(settings: UserSettings): Conversation {
  const now = new Date().toISOString();
  return {
    id: uid("c_"),
    title: "New trip",
    createdAt: now,
    updatedAt: now,
    messages: [],
    stage: "collecting",
    prefs: {
      currency: settings.currency,
      ...(settings.travelStyle.nonstop ? { nonstopOnly: true } : {}),
      ...(settings.travelStyle.carryOnOnly ? { carryOnOnly: true } : {}),
    },
  };
}
