"use client";
import { ArrowDown, ArrowUpRight, CalendarSearch, Info, Palmtree, PiggyBank, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { OrbStage } from "@/components/ai/OrbStage";
import { CarResults, BusinessDirectory } from "@/components/results/CarResults";
import { FlightResults } from "@/components/results/FlightResults";
import { HotelResults } from "@/components/results/HotelResults";
import { offerTitle } from "@/components/results/OfferActions";
import { useToast } from "@/components/ui/Toast";
import { carsQuestion, staysQuestion } from "@/lib/ai/followups";
import { airportByCode } from "@/lib/data/catalog";
import type { MessageKey } from "@/lib/i18n";
import { newConversation, useStore } from "@/lib/store/AppStore";
import { getSupabase } from "@/lib/supabase/client";
import { messageAttachments, type AgentReply, type Attachment, type ChatMessage, type Chip, type ChipAction, type ClientAction, type Conversation, type FlightSearchParams, type OfferKind, type TripPreferences } from "@/lib/types";
import { DURATION, stagger, type OrbMood } from "@/lib/motion";
import { takePendingPrompt } from "@/lib/pendingPrompt";
import { cx, formatRange, money, toISODate, uid } from "@/lib/utils";
import { Composer, type ComposerHandle, type ComposerState } from "./Composer";
import { EditSearchDialog } from "./EditSearchDialog";
import { AssistantMessage, ErrorRow, Thinking, UserMessage } from "./Messages";
import { TripBrief } from "./TripBrief";

type QuickPrefs = Pick<TripPreferences, "nonstopOnly" | "carryOnOnly" | "flexibleDates">;

const SUGGESTIONS: { key: MessageKey; icon: typeof Sparkles; en: string; fr: string }[] = [
  { key: "suggest.cheap", icon: PiggyBank, en: "Find me a cheap getaway for a long weekend", fr: "Trouve-moi une escapade pas chère pour un long week-end" },
  { key: "suggest.japan", icon: Sparkles, en: "Plan a trip to Japan", fr: "Planifie un voyage au Japon" },
  { key: "suggest.dates", icon: CalendarSearch, en: "I already know my dates — help me find the best flights", fr: "Je connais déjà mes dates, aide-moi à trouver les meilleurs vols" },
  { key: "suggest.warm", icon: Palmtree, en: "Discover somewhere warm in February", fr: "Découvre un endroit chaud en février" },
];

const EXAMPLES = {
  en: ["Somewhere warm in February, under $800…", "Tokyo for two in the spring…", "A long weekend in Lisbon from Toronto…", "Paris, March 10 to 17, nonstop…"],
  fr: ["Un endroit chaud en février, moins de 800 $…", "Tokyo à deux au printemps…", "Un long week-end à Lisbonne depuis Toronto…", "Paris du 10 au 17 mars, vol direct…"],
};

let statusCache: Promise<{ ai: string }> | null = null;

function OrbitBackdrop({ leaving }: { leaving: boolean }) {
  return (
    <div className={cx("ambient", leaving && "ambient--leave")} aria-hidden="true">
      <svg viewBox="0 0 1100 620" fill="none">
        <g stroke="currentColor" strokeWidth="1">
          <ellipse cx="550" cy="214" rx="210" ry="64" transform="rotate(-8 550 214)" />
          <ellipse cx="550" cy="214" rx="340" ry="112" transform="rotate(-8 550 214)" strokeDasharray="2 7" />
          <ellipse cx="550" cy="214" rx="500" ry="170" transform="rotate(-8 550 214)" />
        </g>
      </svg>
    </div>
  );
}

export function Assistant() {
  const store = useStore();
  const { t, settings } = store;
  const router = useRouter();
  const conv = store.conversations.find((c) => c.id === store.activeId) ?? null;
  const convRef = useRef<Conversation | null>(conv);
  convRef.current = conv;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ retry: () => void; message?: string } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [engine, setEngine] = useState<"demo" | "openai" | null>(null);
  const [editing, setEditing] = useState<FlightSearchParams | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [draftPrefs, setDraftPrefs] = useState<QuickPrefs>({});
  const [flash, setFlash] = useState<"success" | "error" | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const composer = useRef<ComposerHandle>(null);
  const welcomeAnchor = useRef<HTMLDivElement>(null);
  const focusAnchor = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const orbSlot = useRef<HTMLSpanElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const emptyRef = useRef(true);
  const L = (en: string, fr: string) => (settings.locale === "fr" ? fr : en);

  useEffect(() => {
    statusCache ??= fetch("/api/status").then((r) => r.json());
    statusCache.then((s) => setEngine(s.ai === "openai" ? "openai" : "demo")).catch(() => setEngine("demo"));
  }, []);

  useEffect(() => {
    setDraftPrefs({ nonstopOnly: settings.travelStyle.nonstop || undefined, carryOnOnly: settings.travelStyle.carryOnOnly || undefined, flexibleDates: settings.travelStyle.flexibleDates || undefined });
  }, [settings.travelStyle]);

  useEffect(() => {
    const onNew = () => {
      setError(null);
      setFlash(null);
      setAnimatingId(null);
      requestAnimationFrame(() => composer.current?.focus());
    };
    window.addEventListener("pyrius:new-trip", onNew);
    return () => window.removeEventListener("pyrius:new-trip", onNew);
  }, []);

  // A trip typed on the website before signing up opens here as a fresh draft.
  useEffect(() => {
    const prompt = takePendingPrompt();
    if (!prompt) return;
    if (!emptyRef.current) store.setActiveId(null);
    requestAnimationFrame(() => composer.current?.setText(prompt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switching conversations: jump to the end without animation.
  useLayoutEffect(() => {
    setAnimatingId(null);
    setError(null);
    stick.current = true;
    const el = scroller.current;
    if (el) el.scrollTop = emptyRef.current ? 0 : el.scrollHeight;
  }, [store.activeId]);

  // The focus orb centres in the space above the composer, which grows as you type.
  useEffect(() => {
    const d = dock.current;
    const host = d?.parentElement;
    if (!d || !host) return;
    const ro = new ResizeObserver(() => host.style.setProperty("--dock-h", `${d.offsetHeight}px`));
    ro.observe(d);
    return () => ro.disconnect();
  }, []);

  // Follow new content only while the reader is at the bottom.
  useEffect(() => {
    const el = scroller.current;
    const content = inner.current;
    if (!el || !content) return;
    const ro = new ResizeObserver(() => {
      if (stick.current && !emptyRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current!;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = bottom;
    setAtBottom(bottom);
  };

  const scrollToBottom = (smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    stick.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  // When results arrive, bring the start of that answer into view instead of following to the bottom.
  const onTyped = (m: ChatMessage) => {
    setTyping(false);
    if (!messageAttachments(m).length) return;
    stick.current = false;
    setTimeout(() => {
      const el = scroller.current;
      const node = document.getElementById(`m-${m.id}`);
      if (!el || !node) return;
      const top = el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - 20;
      el.scrollTo({ top, behavior: "smooth" });
    }, 30);
  };

  const save = (c: Conversation) => store.upsertConversation({ ...c, updatedAt: new Date().toISOString() });

  // What the AI needs to know about this conversation and the user's saved offers.
  const contextFor = (c: Conversation) => {
    const latest = <T extends Attachment["type"]>(type: T) => {
      for (let i = c.messages.length - 1; i >= 0; i--) {
        const hit = messageAttachments(c.messages[i]).findLast((a) => a.type === type);
        if (hit) return hit as Extract<Attachment, { type: T }>;
      }
      return undefined;
    };
    const flights = latest("flights");
    const hotels = latest("hotels");
    const cars = latest("cars");
    const tracked = new Map(store.trackers.map((t) => [t.offerId, t]));
    return {
      results: {
        flights: flights && { params: flights.params, sort: flights.filters?.sort, nonstopOnly: flights.filters?.nonstopOnly, carryOnOnly: flights.filters?.carryOnOnly },
        hotels: hotels?.params,
        cars: cars?.params,
      },
      saved: store.saved.slice(0, 60).map((s) => ({
        id: s.id,
        kind: s.kind,
        label: offerTitle(s.data),
        price: s.data.offer.totalPrice,
        currency: s.data.offer.currency,
        tracked: tracked.has(s.id),
        target: tracked.get(s.id)?.targetPrice,
      })),
      plan: store.subscription.plan,
      counts: { saved: store.saved.length, trackers: store.trackers.filter((t) => t.status !== "paused").length },
    };
  };

  // Saves and price tracking the AI asked for go through the same store as the Save and Track buttons.
  const applyActions = (actions: ClientAction[] | undefined, conversationId: string) => {
    for (const a of actions ?? []) {
      if (a.type === "save") {
        const r = store.saveOffer(a.offer, conversationId);
        if (!r.ok) toast({ tone: "info", title: L("Plan limit reached", "Limite du forfait atteinte"), description: r.message });
        else toast({ tone: "save", title: L("Saved to your offers", "Enregistré dans vos offres"), description: offerTitle(a.offer), action: { label: L("View", "Voir"), onClick: () => router.push("/saved") } });
      } else {
        const o = a.offer ?? store.saved.find((s) => s.id === a.offerId)?.data;
        if (!o) continue;
        const r = store.startTracking(o, a.targetPrice, conversationId);
        if (!r.ok) toast({ tone: "info", title: L("Plan limit reached", "Limite du forfait atteinte"), description: r.message });
        else
          toast({
            tone: "save",
            title: L("Tracking this price", "Suivi du prix activé"),
            description: `${offerTitle(o)} · ${L("target", "cible")} ${money(a.targetPrice, o.offer.currency, settings.locale)}`,
            action: { label: L("View", "Voir"), onClick: () => router.push("/tracking") },
          });
      }
    }
  };

  const request = useCallback(
    async (c: Conversation, text: string, action?: ChipAction) => {
      setPending(true);
      setError(null);
      setFlash(null);
      const started = Date.now();
      try {
        const token = store.auth.mode === "cloud" ? (await getSupabase()?.auth.getSession())?.data.session?.access_token : undefined;
        // The newest message is the one being sent; earlier ones are the history.
        const earlier = c.messages.at(-1)?.role === "user" ? c.messages.slice(0, -1) : c.messages;
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            message: text,
            action,
            prefs: c.prefs,
            stage: c.stage,
            locale: settings.locale,
            homeAirport: settings.homeAirport,
            today: toISODate(new Date()),
            history: earlier.slice(-12).map((m) => ({ role: m.role, content: m.text })),
            ...contextFor(c),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(typeof body.error === "string" ? body.error : "");
        }
        const reply: AgentReply = await res.json();
        await new Promise((r) => setTimeout(r, Math.max(0, 650 - (Date.now() - started))));
        const attachments = reply.attachments ?? (reply.attachment ? [reply.attachment] : undefined);
        const ai: ChatMessage = { id: uid("m_"), role: "assistant", text: reply.reply, chips: reply.chips, attachments, at: new Date().toISOString() };
        setEngine(reply.engine);
        applyActions(reply.actions, c.id);
        // Calm success: a short pulse from the orb, then back to idle.
        setPulseKey((k) => k + 1);
        setFlash("success");
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash((f) => (f === "success" ? null : f)), DURATION.successPulse);
        setAnimatingId(ai.id);
        setTyping(true);
        save({ ...c, messages: [...c.messages, ai], prefs: reply.prefs, stage: reply.stage, title: reply.title ?? c.title });
      } catch (err) {
        setFlash("error");
        setError({ retry: () => request(c, text, action), message: (err as Error).message || undefined });
      } finally {
        setPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.locale, settings.homeAirport, store.saved, store.trackers, store.subscription, store.auth.mode],
  );

  const send = (text: string, action?: ChipAction) => {
    if (pending || typing) return;
    let base = convRef.current;
    if (!base) {
      const fresh = newConversation(settings);
      base = { ...fresh, prefs: { ...fresh.prefs, ...stripUndefined(draftPrefs), askedPrefs: Object.values(draftPrefs).some(Boolean) || undefined } };
    }
    if (!base.messages.length) {
      // Welcome dissolves while the orb flies down into the composer.
      setDrafting(false);
      setLeaving(true);
      setTimeout(() => setLeaving(false), DURATION.welcomeLeave);
    }
    const user: ChatMessage = { id: uid("m_"), role: "user", text, at: new Date().toISOString() };
    const c: Conversation = {
      ...base,
      messages: [...base.messages, user],
      title: base.messages.length ? base.title : text.length > 42 ? `${text.slice(0, 40).trim()}…` : text,
    };
    save(c);
    store.setActiveId(c.id);
    convRef.current = c;
    setTimeout(() => scrollToBottom(false), 0);
    request(c, text, action);
  };

  const onChip = (chip: Chip) => {
    if (chip.action.type === "navigate") return router.push(chip.action.href);
    send(chip.label, chip.action.type === "say" ? chip.action : chip.action);
  };

  const appendAssistant = (c: Conversation, msg: Omit<ChatMessage, "id" | "at" | "role">, patch: Partial<Conversation>) => {
    const ai: ChatMessage = { ...msg, id: uid("m_"), role: "assistant", at: new Date().toISOString() };
    setAnimatingId(ai.id);
    setTyping(true);
    save({ ...c, ...patch, messages: [...c.messages, ai] });
    stick.current = true;
  };

  const onSaved = (kind: OfferKind) => {
    const c = convRef.current;
    if (!c || pending || typing) return;
    if (kind === "flight" && c.stage === "flights") {
      const q = staysQuestion(settings.locale);
      appendAssistant(c, { text: q.text, chips: q.chips }, { stage: "offer-hotels" });
    } else if (kind === "hotel" && c.stage === "hotels") {
      const q = carsQuestion(settings.locale, true);
      appendAssistant(c, { text: q.text, chips: q.chips }, { stage: "offer-cars" });
    }
  };

  const applyEdit = (p: FlightSearchParams) => {
    const c = convRef.current;
    setEditing(null);
    if (!c) return;
    const route = `${airportByCode(p.originCode)?.city} → ${airportByCode(p.destinationCode)?.city}`;
    appendAssistant(
      c,
      {
        text: L(
          `Updated. Here are options for ${route}, ${formatRange(p.departDate, p.returnDate, settings.locale)}. Same as before, these are demo prices rather than live fares.`,
          `C'est à jour. Voici les options pour ${route}, ${formatRange(p.departDate, p.returnDate, settings.locale)}. Comme avant, ce sont des prix de démonstration.`,
        ),
        attachment: { type: "flights", params: p, budget: c.prefs.budget || undefined, filters: { nonstopOnly: c.prefs.nonstopOnly, carryOnOnly: c.prefs.carryOnOnly } },
        chips: [{ label: L("Find a place to stay", "Trouver un hébergement"), action: { type: "hotels", stayType: "hotel" } }],
      },
      {
        stage: "flights",
        title: route,
        prefs: { ...c.prefs, originCode: p.originCode, destinationCode: p.destinationCode, departDate: p.departDate, returnDate: p.returnDate, adults: p.adults, children: p.children, durationDays: undefined },
      },
    );
  };

  const quickPrefs: QuickPrefs = conv ? { nonstopOnly: conv.prefs.nonstopOnly, carryOnOnly: conv.prefs.carryOnOnly, flexibleDates: conv.prefs.flexibleDates } : draftPrefs;
  const onPrefsChange = (p: QuickPrefs) => {
    if (conv) save({ ...conv, prefs: { ...conv.prefs, ...p, askedPrefs: true } });
    else setDraftPrefs(p);
  };

  const renderAttachment = (a: Attachment, c: Conversation) => {
    switch (a.type) {
      case "flights":
        return <FlightResults attachment={a} conversationId={c.id} onSaved={onSaved} onEdit={() => setEditing(a.params)} />;
      case "hotels":
        return <HotelResults attachment={a} conversationId={c.id} onSaved={onSaved} />;
      case "cars":
        return <CarResults attachment={a} conversationId={c.id} onSaved={onSaved} />;
      case "businesses":
        return <BusinessDirectory attachment={a} />;
    }
  };

  const empty = !conv || conv.messages.length === 0;
  const showWelcome = empty || leaving;
  emptyRef.current = showWelcome;
  // Typing on the welcome screen clears everything but the orb, which moves to the centre.
  const focus = drafting && empty && !leaving;
  const lastId = conv?.messages.at(-1)?.id;
  const mood: OrbMood = listening || focus ? "listening" : pending ? "thinking" : flash ?? "idle";
  const composerState: ComposerState = pending ? "processing" : flash ?? "idle";
  const savedKinds = useMemo(() => new Set<OfferKind>(store.saved.filter((s) => s.conversationId === conv?.id).map((s) => s.kind)), [store.saved, conv?.id]);

  const statusText = listening
    ? L("Listening — speak naturally, then tap stop.", "À l'écoute — parlez naturellement, puis touchez arrêter.")
    : pending
      ? L("Pyrius is working on your request…", "Pyrius traite votre demande…")
      : flash === "error"
        ? L("Couldn't reach Pyrius. Your message is kept — try again.", "Impossible de joindre Pyrius. Votre message est conservé — réessayez.")
        : flash === "success"
          ? L("Reply ready.", "Réponse prête.")
          : L("Pyrius suggests and compares; you always book directly with the provider. Prices shown are demo data.", "Pyrius suggère et compare; vous réservez toujours directement auprès du fournisseur. Les prix affichés sont des données de démonstration.");

  const modePill = engine && (
    <span className="mode-pill" data-live={engine === "openai"} title={engine === "openai" ? "Field extraction by your configured AI model. Offers always come from the travel provider." : t("chat.demoModeHint")}>
      <span className="mode-pill__dot" />
      {engine === "openai" ? t("chat.liveMode") : t("chat.demoMode")}
      <Info style={{ width: 12, height: 12, opacity: 0.6 }} />
    </span>
  );

  return (
    <div className="chat" data-mood={mood} data-focus={focus}>
      <OrbStage
        mood={mood}
        pulseKey={pulseKey}
        anchor={focus ? focusAnchor : showWelcome && !leaving ? welcomeAnchor : orbSlot}
        anchorKey={focus ? "focus" : showWelcome && !leaving ? "welcome" : "dock"}
      />
      {showWelcome && <div className="orb-anchor chat__focus-orb" ref={focusAnchor} aria-hidden="true" />}
      {showWelcome && <div className="chat__bar">{modePill}</div>}

      <div className="chat__scroll" ref={scroller} onScroll={onScroll}>
        {!showWelcome && conv && <TripBrief conv={conv} saved={savedKinds} locale={settings.locale} pending={pending} aside={modePill} />}
        {showWelcome && <OrbitBackdrop leaving={leaving} />}
        <div className={showWelcome ? "chat__inner chat__inner--empty" : "chat__inner"} ref={inner}>
          {showWelcome ? (
            <section className={cx("welcome", leaving && "welcome--leave")} aria-labelledby="welcome-title" aria-hidden={focus || undefined}>
              <div className="orb-anchor welcome__orb" ref={welcomeAnchor} />
              <span className="welcome__eyebrow">
                <i aria-hidden="true" />
                {t("brand.tagline")}
              </span>
              <h1 id="welcome-title" className="t-display welcome__title">
                {t("welcome.title")}
              </h1>
              <div className="suggest m-stagger">
                {SUGGESTIONS.map(({ key, icon: Icon, en, fr }, i) => (
                  <button key={key} className="suggest__card m-press" data-glow style={stagger(i + 2)} onClick={() => send(settings.locale === "fr" ? fr : en)} disabled={pending || leaving || focus}>
                    <span className="suggest__icon">
                      <Icon />
                    </span>
                    <span className="suggest__text">
                      <span className="suggest__title" style={{ display: "block" }}>
                        {t(key)}
                      </span>
                    </span>
                    <ArrowUpRight className="suggest__arrow" />
                  </button>
                ))}
              </div>
            </section>
          ) : (
            conv!.messages.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} m={m} />
              ) : (
                <div key={m.id} style={{ display: "contents" }}>
                  <AssistantMessage
                    m={m}
                    animate={m.id === animatingId}
                    onTyped={() => onTyped(m)}
                    showChips={m.id === lastId && !pending}
                    onChip={onChip}
                  >
                    {messageAttachments(m).map((a, i) => (
                      <div key={`${a.type}-${i}`} style={{ display: "contents" }}>
                        {renderAttachment(a, conv!)}
                      </div>
                    ))}
                  </AssistantMessage>
                </div>
              ),
            )
          )}
          {pending && !showWelcome && <Thinking label={L("Pyrius is thinking", "Pyrius réfléchit")} slowLabel={L("Still working on it", "Toujours en cours")} />}
          {error && !showWelcome && (
            <ErrorRow
              text={L("Pyrius couldn't answer that", "Pyrius n'a pas pu répondre")}
              hint={error.message ?? L("The assistant service didn't respond. Nothing was lost — retry when you're ready.", "Le service n'a pas répondu. Rien n'est perdu — réessayez quand vous voulez.")}
              retryLabel={t("chat.retry")}
              onRetry={error.retry}
            />
          )}
        </div>
      </div>

      {!atBottom && !showWelcome && (
        <button className="jump" onClick={() => scrollToBottom()}>
          <ArrowDown />
          Latest
        </button>
      )}

      <div className="dock" ref={dock}>
        <Composer
          ref={composer}
          onSend={(v) => send(v)}
          busy={pending}
          followUp={!showWelcome}
          prefs={quickPrefs}
          onPrefsChange={onPrefsChange}
          onListeningChange={setListening}
          state={composerState}
          orbSlot={orbSlot}
          docked={!(showWelcome && !leaving)}
          examples={EXAMPLES[settings.locale]}
          onDraftChange={setDrafting}
        />
        <p className="composer__foot" data-state={listening ? "listening" : composerState} aria-live="polite">
          <i aria-hidden="true" />
          {statusText}
        </p>
      </div>

      {editing && <EditSearchDialog open onClose={() => setEditing(null)} params={editing} onApply={applyEdit} />}
    </div>
  );
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
