"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, PlanId, PriceTracker, SavedOffer, Subscription, UserSettings } from "@/lib/types";

export interface PersistedState {
  settings?: Partial<UserSettings>;
  conversations?: Conversation[];
  saved?: SavedOffer[];
  trackers?: PriceTracker[];
  subscription?: Subscription;
}

/** Persistence boundary. The store never knows whether data lives in this browser or in Supabase. */
export interface Repository {
  mode: "local" | "cloud";
  load(): Promise<PersistedState>;
  putConversation(c: Conversation): Promise<void>;
  removeConversation(id: string): Promise<void>;
  putSaved(s: SavedOffer): Promise<void>;
  removeSaved(id: string): Promise<void>;
  putTracker(t: PriceTracker): Promise<void>;
  removeTracker(id: string): Promise<void>;
  /** Cloud only: trackers as stored now, including prices the scheduled checks recorded. */
  loadTrackers?(): Promise<PriceTracker[]>;
  putSettings(s: UserSettings): Promise<void>;
  /** Demo-only: local plan preview. Cloud plans change only through the Stripe webhook. */
  putSubscription?(s: Subscription): Promise<void>;
  clear(): Promise<void>;
}

const KEY = "pyrius:v1";

/** Local demo mode: everything stays in this browser's storage. Nothing is synchronized. */
export class LocalRepository implements Repository {
  mode = "local" as const;
  private snap: PersistedState = {};

  private write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.snap));
    } catch {
      // Storage full or blocked (private mode): keep working in memory.
    }
  }

  async load() {
    try {
      this.snap = JSON.parse(localStorage.getItem(KEY) ?? "{}");
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
  async putSubscription(s: Subscription) { this.snap.subscription = s; this.write(); }
  async clear() { this.snap = {}; try { localStorage.removeItem(KEY); } catch {} }
}

/** Signed-in mode: rows in Supabase, isolated per user by row-level security. */
export class SupabaseRepository implements Repository {
  mode = "cloud" as const;
  constructor(private db: SupabaseClient, private userId: string) {}

  private check(res: { error: { message: string } | null }) {
    if (res.error) throw new Error(res.error.message);
  }

  async load(): Promise<PersistedState> {
    const [settings, convs, saved, trackers, sub] = await Promise.all([
      this.db.from("user_settings").select("data").eq("user_id", this.userId).maybeSingle(),
      this.db.from("conversations").select("data").order("updated_at", { ascending: false }).limit(100),
      this.db.from("saved_offers").select("data, saved_at").order("saved_at", { ascending: false }),
      this.db.from("price_trackers").select("data").order("created_at", { ascending: false }),
      this.db.from("subscriptions").select("plan, status").eq("user_id", this.userId).maybeSingle(),
    ]);
    [settings, convs, saved, trackers, sub].forEach((r) => this.check(r));
    return {
      settings: settings.data?.data ?? undefined,
      conversations: (convs.data ?? []).map((r) => r.data),
      saved: (saved.data ?? []).map((r) => r.data),
      trackers: (trackers.data ?? []).map((r) => r.data),
      subscription: sub.data
        ? { plan: sub.data.plan as PlanId, status: sub.data.status === "canceling" || sub.data.status === "past_due" ? sub.data.status : "active", source: "stripe" }
        : undefined,
    };
  }

  async putConversation(c: Conversation) {
    this.check(await this.db.from("conversations").upsert({ id: c.id, user_id: this.userId, data: c, updated_at: c.updatedAt }));
  }
  async removeConversation(id: string) {
    this.check(await this.db.from("conversations").delete().eq("id", id));
  }
  async putSaved(s: SavedOffer) {
    this.check(await this.db.from("saved_offers").upsert({ id: s.id, user_id: this.userId, kind: s.kind, data: s, saved_at: s.savedAt }));
  }
  async removeSaved(id: string) {
    this.check(await this.db.from("saved_offers").delete().eq("id", id));
  }
  async putTracker(t: PriceTracker) {
    this.check(
      await this.db.from("price_trackers").upsert({
        id: t.id,
        user_id: this.userId,
        offer_id: t.offerId,
        kind: t.kind,
        provider: t.provider,
        provider_offer_id: t.providerOfferId ?? null,
        currency: t.currency,
        last_known_price: t.lastKnownPrice,
        target_price: t.targetPrice,
        last_checked_at: t.lastCheckedAt,
        status: t.status,
        data: t,
        created_at: t.createdAt,
      }),
    );
  }
  async removeTracker(id: string) {
    this.check(await this.db.from("price_trackers").delete().eq("id", id));
  }
  async loadTrackers() {
    const res = await this.db.from("price_trackers").select("data").order("created_at", { ascending: false });
    this.check(res);
    return (res.data ?? []).map((r) => r.data as PriceTracker);
  }
  async putSettings(s: UserSettings) {
    this.check(await this.db.from("user_settings").upsert({ user_id: this.userId, data: s, updated_at: new Date().toISOString() }));
  }
  async clear() {
    // Cloud data is only removed through explicit per-item deletes.
  }
}
