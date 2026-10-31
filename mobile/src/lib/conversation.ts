import { useCallback } from "react";
import { applyFlightFilters } from "@/lib/flights/filters";
import { flightBrief } from "@/lib/flights/brief";
import { hotelBrief, sortStays } from "@/lib/hotels/brief";
import { offerTitle } from "@/lib/offers";
import { newConversation } from "@/lib/store/defaults";
import { messageAttachments, type AgentReply, type AgentStage, type AnyOffer, type Attachment, type ChatMessage, type ChipAction, type ClientAction, type Conversation, type TripPreferences } from "@/lib/types";
import { money, toISODate, uid } from "@/lib/utils";
import { toast } from "~/components/Toast";
import { api } from "./api";
import { useStore } from "./store";
import type { PendingUpload } from "./uploads";

/**
 * One conversation engine for text and voice. Both read the same conversation (trip, results on
 * screen, saved offers) and write into it, so switching between typing and talking loses nothing.
 */

export type QuickPrefs = Pick<TripPreferences, "nonstopOnly" | "carryOnOnly" | "flexibleDates">;

export function useConversationEngine() {
  const store = useStore();
  const { settings, L } = store;

  /** What the AI needs to know: the cards on screen in their order, saved offers, plan and counts. Same as the web app. */
  const contextFor = useCallback(
    (c: Conversation) => {
      const latest = <T extends Attachment["type"]>(type: T) => {
        for (let i = c.messages.length - 1; i >= 0; i--) {
          const hit = [...messageAttachments(c.messages[i])].reverse().find((a) => a.type === type);
          if (hit) return hit as Extract<Attachment, { type: T }>;
        }
        return undefined;
      };
      const flights = latest("flights");
      const hotels = latest("hotels");
      const tracked = new Map(store.trackers.map((t) => [t.offerId, t]));
      const snap = flights?.snapshot;
      const shown = snap
        ? applyFlightFilters([...snap.offers], { sort: flights.filters?.sort ?? "price", stops: flights.filters?.nonstopOnly ? "0" : "any", window: "any", airlines: [], maxPrice: null, carryOn: Boolean(flights.filters?.carryOnOnly) }).map((o, i) => flightBrief(o, i + 1))
        : [];
      return {
        results: {
          flights: flights && { params: flights.params, sort: flights.filters?.sort, source: snap?.source, fetchedAt: snap?.fetchedAt, shown },
          hotels: hotels && { params: hotels.params, shown: sortStays(hotels.snapshot?.offers ?? [], hotels.sort ?? "price").map((h, i) => hotelBrief(h, i + 1)) },
        },
        saved: store.saved.slice(0, 60).map((s) => ({ id: s.id, kind: s.kind, label: offerTitle(s.data), price: s.data.offer.totalPrice, currency: s.data.offer.currency, tracked: tracked.has(s.id), target: tracked.get(s.id)?.targetPrice })),
        plan: store.subscription.plan,
        counts: { saved: store.saved.length, trackers: store.trackers.filter((t) => t.status !== "paused").length },
      };
    },
    [store.saved, store.trackers, store.subscription.plan],
  );

  /** The body every AI call starts from: the trip, stage, settings and the last messages. */
  const basePayload = useCallback(
    (c: Conversation) => {
      const earlier = c.messages.at(-1)?.role === "user" ? c.messages.slice(0, -1) : c.messages;
      return {
        prefs: c.prefs,
        stage: c.stage,
        locale: settings.locale,
        homeAirport: settings.homeAirport,
        today: toISODate(new Date()),
        // Files go to the AI with their own message only; later turns know they were sent.
        history: earlier.slice(-12).map((m) => ({ role: m.role, content: m.uploads?.length ? `${m.text}\n[Attached: ${m.uploads.map((u) => u.name).join(", ")}]`.trim() : m.text })),
        ...contextFor(c),
      };
    },
    [contextFor, settings.locale, settings.homeAirport],
  );

  const findOffer = useCallback(
    (c: Conversation, id: string): AnyOffer | undefined => {
      for (let i = c.messages.length - 1; i >= 0; i--) {
        for (const a of messageAttachments(c.messages[i])) {
          const flight = a.type === "flights" ? a.snapshot?.offers.find((o) => o.id === id) : undefined;
          if (flight) return { kind: "flight", offer: flight };
          const stay = a.type === "hotels" ? a.snapshot?.offers.find((o) => o.id === id) : undefined;
          if (stay) return { kind: "hotel", offer: stay };
        }
      }
      return store.saved.find((s) => s.id === id)?.data;
    },
    [store.saved],
  );

  /** Saves and price tracking the AI asked for go through the same store as the buttons on the cards. */
  const applyActions = useCallback(
    (actions: ClientAction[] | undefined, c: Conversation) => {
      for (const a of actions ?? []) {
        const o = a.offer ?? findOffer(c, a.offerId);
        if (!o) continue;
        const r = a.type === "save" ? store.saveOffer(o, c.id) : store.startTracking(o, a.targetPrice, c.id);
        if (!r.ok) toast({ title: L("Plan limit reached", "Limite du forfait atteinte"), description: r.message });
        else if (a.type === "save") toast({ tone: "ok", title: L("Saved to your offers", "Enregistré dans vos offres"), description: offerTitle(o) });
        else toast({ tone: "ok", title: L("Tracking this price", "Suivi du prix activé"), description: `${offerTitle(o)} · ${L("target", "cible")} ${money(a.targetPrice, o.offer.currency, settings.locale)}` });
      }
    },
    [findOffer, store, L, settings.locale],
  );

  /** The active conversation, or a fresh one with the composer's quick preferences. */
  const ensureConversation = useCallback(
    (draftPrefs?: QuickPrefs) => {
      const existing = store.activeId ? store.getConversation(store.activeId) : undefined;
      if (existing) return existing;
      const fresh = newConversation(settings);
      const extra = Object.fromEntries(Object.entries(draftPrefs ?? {}).filter(([, v]) => v !== undefined));
      const c: Conversation = { ...fresh, title: L("New trip", "Nouveau voyage"), prefs: { ...fresh.prefs, ...extra, askedPrefs: Object.values(extra).some(Boolean) || undefined } };
      store.upsertConversation(c);
      store.setActiveId(c.id);
      return c;
    },
    [store, settings, L],
  );

  /** Adds a message to a conversation (by id, so late voice events land in the right place) and applies trip changes. */
  const append = useCallback(
    (id: string, msg: Omit<ChatMessage, "id" | "at">, patch: Partial<Pick<Conversation, "prefs" | "stage" | "title">> = {}) => {
      const c = store.getConversation(id);
      if (!c) return null;
      const m: ChatMessage = { ...msg, id: uid("m_"), at: new Date().toISOString() };
      const title = c.messages.length === 0 && m.role === "user" ? (m.text.length > 42 ? `${m.text.slice(0, 40).trim()}…` : m.text) : patch.title ?? c.title;
      const next: Conversation = { ...c, ...patch, title, messages: [...c.messages, m], updatedAt: new Date().toISOString() };
      store.upsertConversation(next);
      return { conversation: next, message: m };
    },
    [store],
  );

  /** Updates trip details without a message (voice tool results, preference toggles). */
  const patch = useCallback(
    (id: string, p: Partial<Pick<Conversation, "prefs" | "stage" | "title">>) => {
      const c = store.getConversation(id);
      if (!c) return;
      store.upsertConversation({ ...c, ...p, updatedAt: new Date().toISOString() });
    },
    [store],
  );

  /** Sends a typed (or dictated) message, with any photos and files, to the concierge and appends its reply. */
  const ask = useCallback(
    async (convId: string, text: string, action?: ChipAction, files?: PendingUpload[]) => {
      const c = store.getConversation(convId);
      if (!c) throw new Error("Conversation not found");
      const uploads = files?.length ? files.map((f) => ({ name: f.name, type: f.type, data: f.data })) : undefined;
      const reply = await api<AgentReply>("/api/chat", { message: text, action, uploads, ...basePayload(c) });
      const attachments = reply.attachments ?? (reply.attachment ? [reply.attachment] : undefined);
      const res = append(convId, { role: "assistant", text: reply.reply, chips: reply.chips, attachments, sources: reply.sources }, { prefs: reply.prefs, stage: reply.stage as AgentStage, title: reply.title ?? c.title });
      if (res) applyActions(reply.actions, res.conversation);
      return reply;
    },
    [store, basePayload, append, applyActions],
  );

  return { contextFor, basePayload, applyActions, ensureConversation, append, patch, ask };
}
