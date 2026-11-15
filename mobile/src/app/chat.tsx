import { router, useLocalSearchParams } from "expo-router";
import { BedDouble, CarFront, Plane, SquarePen } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { placeName } from "@/lib/data/world";
import { echo, GREETING, resultsMessage, stepMessage } from "@/lib/flights/copy";
import { canSearch, nextStep, resultsMatch, searchPlan, setCabin, setDates, setDestination, setLegs, setOrigin, setTravelers, setTripKind, tripKind } from "@/lib/flights/workflow";
import { messageAttachments, type Attachment, type ChatMessage, type Chip as ChipT, type ChipAction, type Conversation, type TripPreferences } from "@/lib/types";
import { toISODate, uid } from "@/lib/utils";
import { Composer, type ComposerHandle } from "~/components/chat/Composer";
import { AssistantMessage, ErrorRow, Thinking, UserMessage } from "~/components/chat/Messages";
import { PrefsSheet } from "~/components/chat/Sheets";
import { Drawer } from "~/components/Drawer";
import { FlowPanel, TripEditor, type EditTarget, type FlowHandlers, type ResultSort } from "~/components/flow/FlowPanel";
import { Glow } from "~/components/Glow";
import { Orb, type MobileOrbMood } from "~/components/Orb";
import { toast } from "~/components/Toast";
import { Headline, IconButton, T, tap } from "~/components/ui";
import { ApiError } from "~/lib/api";
import { useConversationEngine, type QuickPrefs } from "~/lib/conversation";
import { useKeyboardPadding } from "~/lib/keyboard";
import { useStore } from "~/lib/store";
import { colors, radii } from "~/lib/theme";
import type { PendingUpload } from "~/lib/uploads";

const SPHERE = 150;
const DOCKED = 26;

/** Claude-style menu glyph: three lines, shorter as they go down. */
function MenuGlyph() {
  return (
    <View style={{ gap: 5 }}>
      <View style={[s.bar, { width: 22 }]} />
      <View style={[s.bar, { width: 17 }]} />
      <View style={[s.bar, { width: 11 }]} />
    </View>
  );
}

/** What a first message is about, so flight controls don't appear under a hotel or car request. */
function focusOf(text: string): Conversation["focus"] {
  const t = text.toLowerCase();
  if (/\b(hotels?|hôtels?|stay|resort|airbnb|apartments?|appartements?|logement|hébergement|chambre|room)\b/.test(t)) return "hotels";
  if (/\b(cars?|voitures?|rental car|car rental|location de voiture|dealerships?|concessionnaires?|concession)\b/.test(t)) return "cars";
  return undefined;
}

/** A welcome choice: a quiet pill with an icon. */
function Start({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [s.start, pressed && { backgroundColor: colors.surface }]}
    >
      {icon}
      <T weight="medium" style={{ fontSize: 14 }}>{label}</T>
    </Pressable>
  );
}

type Problem = { convId: string; text: string; action?: ChipAction; files?: PendingUpload[]; message?: string };

export default function Chat() {
  const store = useStore();
  const { L, settings, activeId, conversations, signOut } = store;
  const lang = settings.locale === "fr" ? "fr" : "en";
  const engine = useConversationEngine();
  const insets = useSafeAreaInsets();
  const pad = useKeyboardPadding(8);
  const composer = useRef<ComposerHandle>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const stick = useRef(true);
  const ys = useRef<Record<string, number>>({});
  const searchSeq = useRef(0);

  const [menu, setMenu] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Problem | null>(null);
  const [flash, setFlash] = useState<"success" | "error" | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [flowNote, setFlowNote] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [draftPrefs, setDraftPrefs] = useState<QuickPrefs>({
    nonstopOnly: settings.travelStyle.nonstop || undefined,
    carryOnOnly: settings.travelStyle.carryOnOnly || undefined,
    flexibleDates: settings.travelStyle.flexibleDates || undefined,
  });

  const conv = conversations.find((c) => c.id === activeId) ?? null;
  const empty = !conv || conv.messages.length === 0;
  const lastId = conv?.messages.at(-1)?.id;
  const today = toISODate(new Date());

  useEffect(() => {
    stick.current = true;
  }, [activeId]);
  // Notes and editors belong to the conversation they were opened in.
  const [shownId, setShownId] = useState(activeId);
  if (shownId !== activeId) {
    setShownId(activeId);
    setFlowNote(null);
    setSearchError(null);
    setEditTarget(null);
  }

  // When an answer brings results, show the start of the answer instead of jumping to the last card.
  const last = conv?.messages.at(-1);
  useEffect(() => {
    if (!last || last.role !== "assistant" || !(last.attachments?.length || last.attachment)) return;
    stick.current = false;
    const id = setTimeout(() => {
      const y = ys.current[last.id];
      if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    }, 80);
    return () => clearTimeout(id);
  }, [last]);

  const flashFor = (f: "success" | "error") => {
    setFlash(f);
    setTimeout(() => setFlash((x) => (x === f ? null : x)), 1200);
  };

  const ask = useCallback(
    async (id: string, text: string, action?: ChipAction, files?: PendingUpload[]) => {
      setPending(true);
      setError(null);
      try {
        await engine.ask(id, text, action, files);
        setPulseKey((k) => k + 1);
        flashFor("success");
      } catch (e) {
        flashFor("error");
        // A signed-out or expired session: the message stays in the conversation; sign in again to continue.
        if (e instanceof ApiError && e.status === 401) signOut();
        setError({ convId: id, text, action, files, message: e instanceof ApiError ? e.message : undefined });
      } finally {
        setPending(false);
      }
    },
    [engine, signOut],
  );

  const send = (text: string, action?: ChipAction, files?: PendingUpload[], focus?: Conversation["focus"]) => {
    if (pending || searching) return;
    Keyboard.dismiss();
    const c = engine.ensureConversation(draftPrefs, focus ?? focusOf(text));
    const uploads = files?.length ? files.map((f) => ({ name: f.name, kind: f.kind, uri: f.uri })) : undefined;
    engine.append(c.id, { role: "user", text, uploads });
    stick.current = true;
    setDrafting(false);
    setFlowNote(null);
    ask(c.id, text, action, files);
  };

  const onChip = (chip: ChipT) => {
    if (chip.action.type === "navigate") return;
    send(chip.label, chip.action);
  };

  /* ---------------- Flight workflow: controls move the trip forward without waiting for the AI ---------------- */

  /** The newest set of flight results in the conversation (several for multi-city). */
  const latestFlights = (c: Conversation) => {
    for (let i = c.messages.length - 1; i >= 0; i--) {
      const list = messageAttachments(c.messages[i]).filter((a): a is Extract<Attachment, { type: "flights" }> => a.type === "flights");
      if (list.length) return { messageId: c.messages[i].id, list };
    }
    return null;
  };
  const freshResults = (c: Conversation) => {
    const g = latestFlights(c);
    return Boolean(g && resultsMatch(c.prefs, g.list.map((a) => a.params), today));
  };
  const current = () => (store.activeId ? store.getConversation(store.activeId) : undefined);

  /**
   * A choice made with a control: the workflow commits it (or says why it can't), the choice appears
   * as the user's message, and Pyrius asks for the next detail right away.
   */
  const advance = (update: (t: TripPreferences) => { trip: TripPreferences; error?: string }, said: (t: TripPreferences) => string) => {
    if (pending || searching) return;
    const base = engine.ensureConversation(draftPrefs, "flights");
    const r = update(base.prefs);
    if (r.error) return setFlowNote(r.error);
    setFlowNote(null);
    setSearchError(null);
    const t = r.trip;
    const now = new Date().toISOString();
    const greeting: ChatMessage[] = base.messages.length ? [] : [{ id: uid("m_"), role: "assistant", text: GREETING(lang), at: now }];
    const user: ChatMessage = { id: uid("m_"), role: "user", text: said(t), at: now };
    const ai: ChatMessage = { id: uid("m_"), role: "assistant", text: stepMessage(t, nextStep(t, false), lang), at: now };
    const title = t.originCode && t.destinationCode ? `${placeName(t.originCode, lang)} → ${placeName(t.destinationCode, lang)}` : t.destinationCode ? L(`Trip to ${placeName(t.destinationCode, "en")}`, `Voyage à ${placeName(t.destinationCode, "fr")}`) : base.title;
    stick.current = true;
    engine.save({ ...base, title, prefs: t, messages: [...base.messages, ...greeting, user, ai] });
  };

  /** A change from a sheet after results: committed quietly; results for the old trip show as outdated. */
  const commitTrip = (update: (t: TripPreferences) => { trip: TripPreferences; error?: string } | TripPreferences) => {
    const c = current();
    if (!c || pending) return false;
    const r = update(c.prefs);
    const res = "trip" in r ? r : { trip: r as TripPreferences };
    if (res.error) {
      toast({ tone: "error", title: res.error });
      return false;
    }
    engine.save({ ...c, prefs: res.trip });
    return true;
  };

  const runSearch = async () => {
    const c = current();
    if (!c || searching || pending) return;
    const plan = searchPlan(c.prefs, today);
    if (!plan.length) return;
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchError(null);
    stick.current = true;
    try {
      const snaps = await engine.searchFlights(plan);
      // A newer search started, or the trip changed while this one ran: its results no longer apply.
      const now = store.getConversation(c.id);
      if (seq !== searchSeq.current || !now || !resultsMatch(now.prefs, plan, today)) return;
      const sort = now.prefs.priority === "fastest" ? "duration" : "price";
      const attachments: Attachment[] = plan.map((params, i) => ({
        type: "flights",
        params,
        snapshot: snaps[i],
        budget: now.prefs.budget || undefined,
        filters: { sort, nonstopOnly: now.prefs.nonstopOnly, carryOnOnly: now.prefs.carryOnOnly },
        leg: plan.length > 1 ? { index: i, count: plan.length } : undefined,
      }));
      engine.append(now.id, { role: "assistant", text: resultsMessage(plan, snaps, lang), attachments }, { stage: "flights" });
      setPulseKey((k) => k + 1);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) signOut();
      if (seq === searchSeq.current) setSearchError(e instanceof ApiError ? e.message : L("The flight search couldn't be completed.", "La recherche de vols n'a pas abouti."));
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  };

  /** "Cheapest", "Fastest", "Fewest stops": re-sort the latest results in place. */
  const sortResults = (sort: ResultSort) => {
    const c = current();
    const g = c && latestFlights(c);
    if (!c || !g) return;
    const messages = c.messages.map((m) => (m.id !== g.messageId ? m : { ...m, attachments: messageAttachments(m).map((a) => (a.type === "flights" ? { ...a, filters: { ...a.filters, sort } } : a)), attachment: undefined }));
    stick.current = false;
    engine.save({ ...c, messages });
    const y = ys.current[g.messageId];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  const flow: FlowHandlers = {
    onDestination: (code) => advance((t) => setDestination(t, code), (t) => echo("destination", t, lang)),
    onOrigin: (code) => advance((t) => setOrigin(t, code), (t) => echo("origin", t, lang)),
    onTripKind: (k) => void commitTrip((t) => setTripKind(t, k)),
    onDates: (depart, ret) => advance((t) => setDates(t, depart, ret, today), (t) => echo("dates", t, lang)),
    onLegs: (legs) => advance((t) => setLegs(t, legs), (t) => echo("legs", t, lang)),
    onTravelers: (p) => void commitTrip((t) => setTravelers(t, p)),
    onCabin: (cabin) => void commitTrip((t) => setCabin(t, cabin)),
    onSearch: runSearch,
    onSort: sortResults,
    onEdit: (target) => setEditTarget(target === "destination" && conv && tripKind(conv.prefs) === "multi" ? "dates" : target),
    onHotels: () => send(L("Show me hotels there", "Montre-moi des hôtels sur place"), { type: "hotels", stayType: "hotel" }),
  };

  /** The Flights welcome choice: Pyrius asks where to, with the destination search right under it. */
  const startFlights = () => {
    if (pending || searching) return;
    Keyboard.dismiss();
    const c = engine.ensureConversation(draftPrefs, "flights");
    stick.current = true;
    engine.save({ ...c, focus: "flights", title: L("New flight", "Nouveau vol"), messages: [...c.messages, { id: uid("m_"), role: "assistant", text: GREETING(lang), at: new Date().toISOString() }] });
  };

  const quickPrefs: QuickPrefs = conv ? { nonstopOnly: conv.prefs.nonstopOnly, carryOnOnly: conv.prefs.carryOnOnly, flexibleDates: conv.prefs.flexibleDates } : draftPrefs;
  const onPrefsChange = (p: QuickPrefs) => {
    if (conv) engine.patch(conv.id, { prefs: { ...conv.prefs, ...p, askedPrefs: true } });
    else setDraftPrefs(p);
  };

  const newChat = () => {
    store.setActiveId(null);
    setError(null);
    setDrafting(false);
  };

  // A request handed over from Explore or My Trips (lib/handoff): start a new conversation with it.
  const params = useLocalSearchParams<{ ask?: string; k?: string }>();
  const handoff = useRef<{ k: string; text: string } | null>(null);
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!params.ask || !params.k || handled.current === params.k) return;
    handled.current = params.k;
    handoff.current = { k: params.k, text: params.ask };
    store.setActiveId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.k]);
  useEffect(() => {
    // Sent once the new, empty conversation is the active one.
    if (!handoff.current || activeId !== null || pending) return;
    const text = handoff.current.text;
    handoff.current = null;
    send(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, params.k, pending]);

  // Typing on the welcome screen clears everything but the orb, which starts listening (as on the web).
  const focusMode = empty && (drafting || focused);
  const mood: MobileOrbMood = pending || searching ? "thinking" : flash ?? (focusMode ? "listening" : "idle");

  // The workflow's control shows under Pyrius's latest message while the conversation is about flights.
  const lastMessage = conv?.messages.at(-1);
  const movedOn = Boolean(lastMessage && messageAttachments(lastMessage).some((a) => a.type !== "flights"));
  const fresh = conv ? freshResults(conv) : false;
  const step = conv ? nextStep(conv.prefs, fresh) : "destination";
  const flightsTalk = conv?.focus !== "hotels" && conv?.focus !== "cars";
  const showFlow =
    Boolean(conv) &&
    !empty &&
    flightsTalk &&
    lastMessage?.role === "assistant" &&
    (conv!.stage === "collecting" || conv!.stage === "flights") &&
    !movedOn &&
    !pending &&
    !error &&
    !(step === "results" && lastMessage?.chips?.length);
  const latest = conv ? latestFlights(conv) : null;

  return (
    <View style={s.root}>
      {empty ? <Glow cy={0.38} /> : null}

      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <IconButton label={L("Open menu", "Ouvrir le menu")} onPress={() => setMenu(true)} style={{ marginLeft: -6 }}>
          <MenuGlyph />
        </IconButton>
        <View style={s.dock}>
          {!empty ? (
            <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(150)}>
              <Orb mood={mood} sphere={DOCKED} theme={settings.orbTheme} pulseKey={pulseKey} />
            </Animated.View>
          ) : null}
        </View>
        {!empty ? (
          <IconButton label={L("New chat", "Nouvelle discussion")} onPress={newChat} style={{ marginRight: -6 }}>
            <SquarePen color={colors.text} size={21} strokeWidth={1.8} />
          </IconButton>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <Animated.View style={[{ flex: 1 }, pad]}>
        {empty ? (
          <Pressable style={s.welcome} onPress={Keyboard.dismiss} accessible={false}>
            <Animated.View exiting={FadeOut.duration(200)} style={{ alignItems: "center" }}>
              <Orb mood={mood} sphere={SPHERE} theme={settings.orbTheme} pulseKey={pulseKey} />
            </Animated.View>
            {!focusMode ? (
              <Animated.View entering={FadeIn.duration(500).delay(150)} exiting={FadeOut.duration(220)} style={{ marginTop: 8 }}>
                <Headline before={L("Where", "Vous allez")} serif={L("to?", "où ?")} size={44} center />
              </Animated.View>
            ) : null}
          </Pressable>
        ) : (
          <ScrollView
            ref={scroller}
            style={{ flex: 1 }}
            contentContainerStyle={s.list}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onScroll={(e) => {
              const n = e.nativeEvent;
              stick.current = n.contentSize.height - n.contentOffset.y - n.layoutMeasurement.height < 120;
            }}
            scrollEventThrottle={64}
            onContentSizeChange={() => {
              if (stick.current) scroller.current?.scrollToEnd({ animated: true });
            }}
          >
            {conv!.messages.map((m) => {
              const outdated = latest?.messageId === m.id && !fresh;
              return (
                <View key={m.id} onLayout={(e) => (ys.current[m.id] = e.nativeEvent.layout.y)}>
                  {m.role === "user" ? (
                    <UserMessage m={m} />
                  ) : (
                    <AssistantMessage
                      m={m}
                      conversationId={conv!.id}
                      showChips={m.id === lastId && !pending}
                      onChip={onChip}
                      outdated={outdated}
                      onSearchAgain={outdated && canSearch(conv!.prefs, today) ? runSearch : undefined}
                    />
                  )}
                </View>
              );
            })}
            {showFlow && conv ? (
              <FlowPanel key={step} trip={conv.prefs} step={step} today={today} homeCode={settings.homeAirport} busy={searching} hadResults={Boolean(latest)} note={flowNote} h={flow} />
            ) : null}
            {searching ? <Thinking label={L("Searching live fares on Google Flights", "Recherche des tarifs sur Google Flights")} /> : null}
            {searchError && !searching ? <ErrorRow text={L("The flight search didn't finish", "La recherche de vols n'a pas abouti")} hint={searchError} retryLabel={L("Try again", "Réessayer")} onRetry={runSearch} /> : null}
            {pending ? <Thinking label={L("Pyrius is thinking", "Pyrius réfléchit")} /> : null}
            {error && error.convId === conv!.id ? (
              <ErrorRow
                text={L("Pyrius couldn't answer that", "Pyrius n'a pas pu répondre")}
                hint={error.message ?? L("Nothing was lost. Try again when you're ready.", "Rien n'est perdu. Réessayez quand vous voulez.")}
                retryLabel={L("Try again", "Réessayer")}
                onRetry={() => ask(error.convId, error.text, error.action, error.files)}
              />
            ) : null}
          </ScrollView>
        )}

        <View style={s.bottom}>
          {empty && !focusMode ? (
            <Animated.View entering={FadeIn.delay(250).duration(400)} exiting={FadeOut.duration(160)} style={s.starts}>
              <Start icon={<Plane color={colors.text2} size={16} strokeWidth={1.8} />} label={L("Flights", "Vols")} onPress={startFlights} />
              <Start icon={<BedDouble color={colors.text2} size={16} strokeWidth={1.8} />} label={L("Hotels", "Hôtels")} onPress={() => send(L("I'm looking for a hotel.", "Je cherche un hôtel."), undefined, undefined, "hotels")} />
              <Start icon={<CarFront color={colors.text2} size={16} strokeWidth={1.8} />} label={L("Cars", "Voitures")} onPress={() => send(L("I'm looking for a car: a rental agency or a dealership.", "Je cherche une voiture : une agence de location ou un concessionnaire."), undefined, undefined, "cars")} />
            </Animated.View>
          ) : null}
          <Composer
            ref={composer}
            onSend={(v, files) => send(v, undefined, files)}
            onVoice={() => router.push("/voice")}
            onPrefs={() => setPrefsOpen(true)}
            prefs={quickPrefs}
            busy={pending || searching}
            placeholder={empty ? L("Describe your trip", "Décrivez votre voyage") : L("Reply to Pyrius", "Répondre à Pyrius")}
            onDraftChange={setDrafting}
            onFocusChange={setFocused}
          />
        </View>
      </Animated.View>

      <PrefsSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} prefs={quickPrefs} onChange={onPrefsChange} />
      {conv && editTarget ? (
        <TripEditor
          target={editTarget}
          trip={conv.prefs}
          today={today}
          homeCode={settings.homeAirport}
          onClose={() => setEditTarget(null)}
          onAirport={(role, code) => commitTrip((t) => (role === "origin" ? setOrigin(t, code) : setDestination(t, code)))}
          onTripKind={(k) => commitTrip((t) => setTripKind(t, k))}
          onDates={(a, b) => commitTrip((t) => setDates(t, a, b, today))}
        />
      ) : null}
      <Drawer open={menu} onClose={() => setMenu(false)} onNew={newChat} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 6, zIndex: 2 },
  bar: { height: 2, borderRadius: 1, backgroundColor: colors.text },
  dock: { width: DOCKED / 0.56, height: DOCKED / 0.56, alignItems: "center", justifyContent: "center" },
  welcome: { flex: 1, alignItems: "center", justifyContent: "center", gap: 40, paddingBottom: 40 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 22 },
  bottom: { paddingHorizontal: 12, gap: 12 },
  starts: { flexDirection: "row", justifyContent: "center", gap: 8 },
  start: { height: 42, paddingHorizontal: 16, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 },
});
