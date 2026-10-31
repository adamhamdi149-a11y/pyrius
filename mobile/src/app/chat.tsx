import { router, useLocalSearchParams } from "expo-router";
import { SquarePen } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn, ZoomOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Chip as ChipT, ChipAction } from "@/lib/types";
import { Composer, type ComposerHandle } from "~/components/chat/Composer";
import { AssistantMessage, ErrorRow, Thinking, UserMessage } from "~/components/chat/Messages";
import { PrefsSheet } from "~/components/chat/Sheets";
import type { PendingUpload } from "~/lib/uploads";
import { Drawer } from "~/components/Drawer";
import { Glow } from "~/components/Glow";
import { Orb, type MobileOrbMood } from "~/components/Orb";
import { Chip, Headline, IconButton } from "~/components/ui";
import { ApiError } from "~/lib/api";
import { useConversationEngine, type QuickPrefs } from "~/lib/conversation";
import { useKeyboardPadding } from "~/lib/keyboard";
import { useStore } from "~/lib/store";
import { colors } from "~/lib/theme";

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

export default function Chat() {
  const store = useStore();
  const { L, settings, activeId, conversations, signOut } = store;
  const engine = useConversationEngine();
  const insets = useSafeAreaInsets();
  const pad = useKeyboardPadding(8);
  const composer = useRef<ComposerHandle>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const stick = useRef(true);
  const ys = useRef<Record<string, number>>({});

  const [menu, setMenu] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ convId: string; text: string; action?: ChipAction; files?: PendingUpload[]; message?: string } | null>(null);
  const [flash, setFlash] = useState<"success" | "error" | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [draftPrefs, setDraftPrefs] = useState<QuickPrefs>({
    nonstopOnly: settings.travelStyle.nonstop || undefined,
    carryOnOnly: settings.travelStyle.carryOnOnly || undefined,
    flexibleDates: settings.travelStyle.flexibleDates || undefined,
  });

  const conv = conversations.find((c) => c.id === activeId) ?? null;
  const empty = !conv || conv.messages.length === 0;
  const lastId = conv?.messages.at(-1)?.id;

  useEffect(() => {
    stick.current = true;
  }, [activeId]);

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

  const send = (text: string, action?: ChipAction, files?: PendingUpload[]) => {
    if (pending) return;
    Keyboard.dismiss();
    const c = engine.ensureConversation(draftPrefs);
    const uploads = files?.length ? files.map((f) => ({ name: f.name, kind: f.kind, uri: f.uri })) : undefined;
    engine.append(c.id, { role: "user", text, uploads });
    stick.current = true;
    setDrafting(false);
    ask(c.id, text, action, files);
  };

  const onChip = (chip: ChipT) => {
    if (chip.action.type === "navigate") return;
    send(chip.label, chip.action);
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
  const mood: MobileOrbMood = pending ? "thinking" : flash ?? (focusMode ? "listening" : "idle");

  const suggestions = [L("Lisbon in May", "Lisbonne en mai"), L("Somewhere warm", "Un endroit chaud")];

  return (
    <View style={s.root}>
      {empty ? <Glow cy={0.38} /> : null}

      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <IconButton label={L("Open menu", "Ouvrir le menu")} onPress={() => setMenu(true)} style={{ marginLeft: -6 }}>
          <MenuGlyph />
        </IconButton>
        <View style={s.dock}>
          {!empty ? (
            <Animated.View entering={ZoomIn.duration(520).springify().damping(18)} exiting={ZoomOut.duration(200)}>
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
            <Animated.View layout={LinearTransition.duration(420)} exiting={ZoomOut.duration(260)} style={{ alignItems: "center" }}>
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
            {conv!.messages.map((m) => (
              <View key={m.id} onLayout={(e) => (ys.current[m.id] = e.nativeEvent.layout.y)}>
                {m.role === "user" ? <UserMessage m={m} /> : <AssistantMessage m={m} conversationId={conv!.id} showChips={m.id === lastId && !pending} onChip={onChip} />}
              </View>
            ))}
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
            <Animated.View entering={FadeIn.delay(300)} exiting={FadeOut.duration(180)} style={s.suggest}>
              {suggestions.map((x) => (
                <Chip key={x} label={x} onPress={() => send(x)} />
              ))}
            </Animated.View>
          ) : null}
          <Composer
            ref={composer}
            onSend={(v, files) => send(v, undefined, files)}
            onVoice={() => router.push("/voice")}
            onPrefs={() => setPrefsOpen(true)}
            prefs={quickPrefs}
            busy={pending}
            placeholder={empty ? L("Describe your trip", "Décrivez votre voyage") : L("Reply to Pyrius", "Répondre à Pyrius")}
            onDraftChange={setDrafting}
            onFocusChange={setFocused}
          />
        </View>
      </Animated.View>

      <PrefsSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} prefs={quickPrefs} onChange={onPrefsChange} />
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
  suggest: { flexDirection: "row", justifyContent: "center", gap: 8 },
});
