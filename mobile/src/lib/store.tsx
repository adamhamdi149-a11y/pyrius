import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { canAddTracker, canSave, DEFAULT_SUBSCRIPTION, planById } from "@/lib/plans";
import { DEFAULT_SETTINGS } from "@/lib/store/defaults";
import { SupabaseRepository, type PersistedState, type Repository } from "@/lib/store/repository";
import { trackerFromOffer } from "@/lib/tracking/trackers";
import type { AnyOffer, Conversation, PriceTracker, SavedOffer, Subscription, UserSettings, VoiceSettings } from "@/lib/types";
import { supabaseConfigured } from "./config";
import { PENDING_CODE_MAX_AGE, phaseOf, type PendingCode, type Phase } from "./flow";
import { supabase } from "./supabase";

export const DEFAULT_VOICE: VoiceSettings = { enabled: true, voice: "marin", spoken: true, textOnly: false };

const LOCAL_KEY = "pyrius:mobile:v1";
const ONBOARDED_KEY = "pyrius:onboarded:v1";
const PENDING_KEY = "pyrius:pending-code:v1";

/** Startup never waits longer than this on the network: past it, the app opens with what it has. */
const STARTUP_TIMEOUT = 6000;

function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const id = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      () => {
        clearTimeout(id);
        resolve(fallback);
      },
    );
  });
}

async function readPending(): Promise<PendingCode | null> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) ?? "null") as PendingCode | null;
    return v && typeof v.email === "string" && Date.now() - v.sentAt < PENDING_CODE_MAX_AGE ? v : null;
  } catch {
    return null;
  }
}

/** Signed-out or unconfigured mode: data stays on this device only. */
class DeviceRepository implements Repository {
  mode = "local" as const;
  private snap: PersistedState = {};
  private write() {
    AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(this.snap)).catch(() => {});
  }
  async load() {
    try {
      this.snap = JSON.parse((await AsyncStorage.getItem(LOCAL_KEY)) ?? "{}");
    } catch {
      this.snap = {};
    }
    return this.snap;
  }
  private upsert<T extends { id: string }>(key: "conversations" | "saved" | "trackers", item: T) {
    const list = ((this.snap[key] as unknown as T[]) ?? []).filter((x) => x.id !== item.id);
    (this.snap[key] as unknown as T[]) = [item, ...list];
    this.write();
  }
  private remove(key: "conversations" | "saved" | "trackers", id: string) {
    (this.snap[key] as { id: string }[] | undefined) = ((this.snap[key] as { id: string }[]) ?? []).filter((x) => x.id !== id);
    this.write();
  }
  async putConversation(c: Conversation) { this.upsert("conversations", c); }
  async removeConversation(id: string) { this.remove("conversations", id); }
  async putSaved(s: SavedOffer) { this.upsert("saved", s); }
  async removeSaved(id: string) { this.remove("saved", id); }
  async putTracker(t: PriceTracker) { this.upsert("trackers", t); }
  async removeTracker(id: string) { this.remove("trackers", id); }
  async putSettings(s: UserSettings) { this.snap.settings = s; this.write(); }
  async clear() { this.snap = {}; await AsyncStorage.removeItem(LOCAL_KEY); }
}

export type AuthState = { mode: "local" } | { mode: "signed-out" } | { mode: "cloud"; userId: string; email?: string };
type Result = { ok: true } | { ok: false; message: string };

interface Store {
  /** True once sign-in, setup and data are known; the layout keeps the splash up until then. */
  ready: boolean;
  auth: AuthState;
  /** Which part of the app the person belongs in now (see flow.ts). */
  phase: Phase;
  /** A sign-in code sent to this email and not yet entered: the app reopens on the code screen. */
  pendingCode: PendingCode | null;
  setPendingCode: (email: string | null) => void;
  settings: UserSettings;
  voice: VoiceSettings;
  subscription: Subscription;
  conversations: Conversation[];
  saved: SavedOffer[];
  trackers: PriceTracker[];
  activeId: string | null;
  syncError: string | null;
  onboarded: boolean;
  L: (en: string, fr: string) => string;
  setActiveId: (id: string | null) => void;
  getConversation: (id: string) => Conversation | undefined;
  upsertConversation: (c: Conversation) => void;
  deleteConversation: (id: string) => void;
  isSaved: (id: string) => boolean;
  saveOffer: (o: AnyOffer, conversationId?: string) => Result;
  removeSaved: (id: string) => void;
  trackerFor: (offerId: string) => PriceTracker | undefined;
  startTracking: (o: AnyOffer, target: number, conversationId?: string) => Result;
  stopTracking: (id: string) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  updateVoice: (patch: Partial<VoiceSettings>) => void;
  setOnboarded: (done: boolean) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

function deviceLocale(): UserSettings["locale"] {
  try {
    return getLocales()[0]?.languageCode === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [pendingCode, setPendingState] = useState<PendingCode | null>(null);
  const [auth, setAuth] = useState<AuthState>({ mode: supabaseConfigured ? "signed-out" : "local" });
  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_SETTINGS, locale: deviceLocale() });
  const [subscription, setSubscription] = useState<Subscription>(DEFAULT_SUBSCRIPTION);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [saved, setSaved] = useState<SavedOffer[]>([]);
  const [trackers, setTrackers] = useState<PriceTracker[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [onboarded, setOnboardedState] = useState(false);
  const repo = useRef<Repository>(new DeviceRepository());
  // Voice transcripts and tool results arrive asynchronously; they read the latest conversations here.
  const convRef = useRef<Conversation[]>([]);
  useEffect(() => {
    convRef.current = conversations;
  }, [conversations]);

  const persist = useCallback((fn: (r: Repository) => Promise<void>) => {
    fn(repo.current).then(
      () => setSyncError(null),
      (err: Error) => setSyncError(err.message || "Couldn't save your changes."),
    );
  }, []);

  /**
   * Loads a repository's data. The app opens after at most STARTUP_TIMEOUT even on a bad connection;
   * if the data arrives later it still fills in, unless the person has signed in or out since.
   */
  const hydrate = useCallback(async (r: Repository) => {
    repo.current = r;
    const apply = (data: PersistedState) => {
      if (repo.current !== r) return;
      setSettings((s) => ({ ...DEFAULT_SETTINGS, locale: s.locale, ...(data.settings ?? {}) }));
      setConversations((data.conversations ?? []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setSaved(data.saved ?? []);
      setTrackers(data.trackers ?? []);
      setSubscription(data.subscription ?? DEFAULT_SUBSCRIPTION);
    };
    const load = r.load().then(apply, (err: Error) => {
      if (repo.current === r) setSyncError(err.message || "Couldn't load your data.");
    });
    await within(load, STARTUP_TIMEOUT, undefined);
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Device-only state the first screen depends on: read before the app opens.
    Promise.all([AsyncStorage.getItem(ONBOARDED_KEY).catch(() => null), readPending()]).then(([done, pending]) => {
      setOnboardedState(done === "1");
      setPendingState(pending);
      setLocalLoaded(true);
    });
    if (!supabase) {
      // hydrate() only sets state after loading from storage, never synchronously here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      hydrate(new DeviceRepository());
      return;
    }
    let current: string | null | undefined;
    const onSession = (session: { user: { id: string; email?: string } } | null) => {
      const id = session?.user.id ?? null;
      if (id === current) return;
      current = id;
      if (session) {
        setAuth({ mode: "cloud", userId: session.user.id, email: session.user.email });
        // Signed in: the code has done its job.
        setPendingState(null);
        AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
        // Outside the auth callback: Supabase queries made inside it can wait on the auth lock.
        setTimeout(() => hydrate(new SupabaseRepository(supabase!, session.user.id)), 0);
      } else {
        setAuth({ mode: "signed-out" });
        setActiveId(null);
        setTimeout(() => hydrate(new DeviceRepository()), 0);
      }
    };
    // A stored session that needs refreshing goes to the network; don't let that hold the app closed.
    within(supabase.auth.getSession(), STARTUP_TIMEOUT, { data: { session: null }, error: null }).then(({ data }) => {
      if (data.session || current === undefined) onSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => onSession(session));
    return () => data.subscription.unsubscribe();
  }, [hydrate]);

  const ready = hydrated && localLoaded;
  const phase = phaseOf(auth, onboarded);

  const setPendingCode = useCallback((email: string | null) => {
    const next = email ? { email, sentAt: Date.now() } : null;
    setPendingState(next);
    if (next) AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next)).catch(() => {});
    else AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
  }, []);

  const L = useCallback((en: string, fr: string) => (settings.locale === "fr" ? fr : en), [settings.locale]);

  const getConversation = useCallback((id: string) => convRef.current.find((c) => c.id === id), []);

  const upsertConversation = useCallback(
    (c: Conversation) => {
      convRef.current = [c, ...convRef.current.filter((x) => x.id !== c.id)];
      setConversations(convRef.current);
      persist((r) => r.putConversation(c));
    },
    [persist],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      convRef.current = convRef.current.filter((x) => x.id !== id);
      setConversations(convRef.current);
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
        return { ok: false, message: `Your ${planById(subscription.plan).name} plan holds ${planById(subscription.plan).limits.saved} saved offers.` };
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
        const next = { ...existing, targetPrice: target, status: existing.lastKnownPrice <= target ? ("target-reached" as const) : ("active" as const) };
        setTrackers((list) => list.map((x) => (x.id === existing.id ? next : x)));
        persist((r) => r.putTracker(next));
        return { ok: true };
      }
      if (!canAddTracker(subscription, trackers.filter((x) => x.status !== "paused").length)) {
        return { ok: false, message: `Your ${planById(subscription.plan).name} plan tracks up to ${planById(subscription.plan).limits.trackers} prices.` };
      }
      const s = saveOffer(o, conversationId);
      if (!s.ok) return s;
      const tr = trackerFromOffer(o, target);
      setTrackers((list) => [tr, ...list]);
      persist((r) => r.putTracker(tr));
      return { ok: true };
    },
    [persist, saveOffer, subscription, trackers],
  );

  const stopTracking = useCallback(
    (id: string) => {
      setTrackers((list) => list.filter((x) => x.id !== id));
      persist((r) => r.removeTracker(id));
    },
    [persist],
  );

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const updateSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      setSettings(next);
      persist((r) => r.putSettings(next));
    },
    [persist],
  );

  const voice = useMemo(() => ({ ...DEFAULT_VOICE, ...(settings.voice ?? {}) }), [settings.voice]);
  const updateVoice = useCallback((patch: Partial<VoiceSettings>) => updateSettings({ voice: { ...DEFAULT_VOICE, ...(settingsRef.current.voice ?? {}), ...patch } }), [updateSettings]);

  const setOnboarded = useCallback((done: boolean) => {
    setOnboardedState(done);
    AsyncStorage.setItem(ONBOARDED_KEY, done ? "1" : "0").catch(() => {});
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const value: Store = {
    ready,
    auth,
    phase,
    pendingCode,
    setPendingCode,
    settings,
    voice,
    subscription,
    conversations,
    saved,
    trackers,
    activeId,
    syncError,
    onboarded,
    L,
    setActiveId,
    getConversation,
    upsertConversation,
    deleteConversation,
    isSaved,
    saveOffer,
    removeSaved,
    trackerFor,
    startTracking,
    stopTracking,
    updateSettings,
    updateVoice,
    setOnboarded,
    signOut,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
