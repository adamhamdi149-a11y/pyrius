import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import type { AgentStage, Attachment, ClientAction, TripPreferences } from "@/lib/types";
import type { AudioLevels } from "~/components/Orb";
import { toast } from "~/components/Toast";
import { api, apiRaw, ApiError } from "../api";
import { useConversationEngine } from "../conversation";
import { useStore } from "../store";
import { liveVoiceAvailable, RealtimeVoice } from "./realtime";
import { TurnVoice } from "./turns";
import type { TranscriptLine, VoiceCallbacks, VoiceEngine, VoiceSession, VoiceStatus } from "./types";

const TURN_RECORDING = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000, isMeteringEnabled: true };

type ToolResult = { output: unknown; prefs: TripPreferences; stage: AgentStage; attachments?: Attachment[]; actions?: ClientAction[]; title?: string };
export type VoiceProblem = { message: string; kind: "connection" | "permission" | "offline" | "server" | "unsupported" };

/**
 * A voice conversation inside the active Pyrius conversation. Live voice (WebRTC) where the build has
 * it, take-turns voice otherwise (Expo Go). Either way, what was said, the result cards and the trip
 * changes are stored in the same conversation as typed messages.
 */
export function useVoice() {
  const store = useStore();
  const engine = useConversationEngine();
  const { L, voice, settings } = store;
  const recorder = useAudioRecorder(TURN_RECORDING);
  const mode = useMemo(() => (liveVoiceAvailable() ? "live" : "turns"), []);

  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [muted, setMutedState] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [problem, setProblem] = useState<VoiceProblem | null>(null);
  const [ended, setEnded] = useState<"limit" | "expired" | "background" | null>(null);
  const [captions, setCaptions] = useState<{ user?: TranscriptLine; assistant?: TranscriptLine }>({});
  const [conversationId, setConversationId] = useState<string | null>(null);

  const levels = useRef<AudioLevels>({ input: 0, output: 0 });
  const current = useRef<VoiceEngine | null>(null);
  const convId = useRef<string | null>(null);
  const pending = useRef<Attachment[]>([]);
  const mutedRef = useRef(false);
  const replyFile = useRef(0);

  const conversation = () => (convId.current ? store.getConversation(convId.current) : undefined);

  const flushAttachments = (text: string) => {
    const id = convId.current;
    if (!id || (!text && !pending.current.length)) return;
    const attachments = pending.current.length ? pending.current : undefined;
    pending.current = [];
    engine.append(id, { role: "assistant", text, attachments, via: "voice" });
  };

  // The engines call these; a ref keeps them reading the latest state without restarting the session.
  const handlers = useRef<VoiceCallbacks>(null as unknown as VoiceCallbacks);
  handlers.current = {
    onStatus: (s) => setStatus((prev) => (prev === "ended" || prev === "error" ? prev : s)),
    onUserSpeaking: setUserSpeaking,
    onLevels: (input, output) => {
      levels.current.input = mutedRef.current ? 0 : input;
      levels.current.output = output;
    },
    onTranscript: (line) => {
      setCaptions((c) => ({ ...c, [line.role]: line }));
      if (!line.final || line.persisted || !line.text) return;
      const id = convId.current;
      if (!id) return;
      if (line.role === "user") engine.append(id, { role: "user", text: line.text, via: line.typed ? undefined : "voice" });
      else flushAttachments(line.text);
    },
    onToolCall: async (call) => {
      const c = conversation();
      if (!c) return JSON.stringify({ ok: false, error: "No conversation" });
      try {
        const r = await api<ToolResult>("/api/voice/tool", { name: call.name, arguments: call.arguments, ...engine.basePayload(c) });
        engine.patch(c.id, { prefs: r.prefs, stage: r.stage, title: r.title ?? c.title });
        for (const a of r.attachments ?? []) pending.current = [...pending.current.filter((x) => x.type !== a.type), a];
        if (r.actions?.length) engine.applyActions(r.actions, store.getConversation(c.id) ?? c);
        return JSON.stringify(r.output);
      } catch (e) {
        return JSON.stringify({ ok: false, error: e instanceof ApiError ? e.message : "The action couldn't be completed. Tell the user and offer to try again." });
      }
    },
    onError: (message, kind) => {
      if (kind === "server") {
        toast({ tone: "error", title: message });
        return;
      }
      current.current?.stop();
      current.current = null;
      setProblem({ message, kind });
      setStatus("error");
    },
    onEnded: (reason) => {
      stop();
      setEnded(reason);
    },
  };
  const proxy: VoiceCallbacks = useMemo(
    () => ({
      onStatus: (s) => handlers.current.onStatus(s),
      onUserSpeaking: (on) => handlers.current.onUserSpeaking(on),
      onTranscript: (l) => handlers.current.onTranscript(l),
      onLevels: (i, o) => handlers.current.onLevels(i, o),
      onToolCall: (c) => handlers.current.onToolCall(c),
      onError: (m, k) => handlers.current.onError(m, k),
      onEnded: (r) => handlers.current.onEnded(r),
    }),
    [],
  );

  const transcribe = async (uri: string) => {
    const form = new FormData();
    form.append("audio", { uri, name: "turn.m4a", type: "audio/m4a" } as unknown as Blob);
    form.append("language", settings.locale);
    return (await api<{ text: string }>("/api/voice/transcribe", undefined, { form })).text;
  };

  const answer = async (text: string) => {
    const id = convId.current;
    if (!id) return null;
    engine.append(id, { role: "user", text, via: "voice" });
    return (await engine.ask(id, text)).reply;
  };

  const speak = async (text: string) => {
    if (!voice.spoken) return null;
    const res = await apiRaw("/api/voice/speak", { text, voice: voice.voice });
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Two files in turn, so the next reply never overwrites the one still playing.
    const file = new File(Paths.cache, `pyrius-reply-${replyFile.current++ % 2}.mp3`);
    file.create({ overwrite: true });
    file.write(bytes);
    return file.uri;
  };

  const stop = useCallback(() => {
    current.current?.stop();
    current.current = null;
    deactivateKeepAwake("pyrius-voice");
    // Cards found after Pyrius's last sentence still belong in the conversation.
    if (pending.current.length) flushAttachments("");
    levels.current = { input: 0, output: 0 };
    setStatus((s) => (s === "error" ? s : "ended"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    if (current.current) return;
    setProblem(null);
    setEnded(null);
    setCaptions({});
    setStatus("connecting");
    const perm = await requestRecordingPermissionsAsync().catch(() => null);
    if (!perm?.granted) {
      setProblem({ kind: "permission", message: L("Pyrius needs the microphone to talk with you.", "Pyrius a besoin du micro pour vous parler.") });
      setStatus("error");
      return;
    }
    const c = engine.ensureConversation();
    convId.current = c.id;
    setConversationId(c.id);
    const openSession = () => {
      const conv = store.getConversation(c.id) ?? c;
      return api<VoiceSession>("/api/voice/session", { ...engine.basePayload(conv), voice: voice.voice, spoken: voice.spoken });
    };
    const e: VoiceEngine = mode === "live" ? new RealtimeVoice(proxy, openSession) : new TurnVoice(proxy, { recorder, transcribe, answer, speak });
    current.current = e;
    try {
      await e.start();
      e.setMuted(mutedRef.current);
      activateKeepAwakeAsync("pyrius-voice").catch(() => {});
    } catch (err) {
      e.stop();
      current.current = null;
      const code = (err as { code?: string }).code;
      setProblem({ message: (err as Error).message, kind: code === "offline" || (err instanceof ApiError && err.code === "offline") ? "offline" : "connection" });
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, voice.voice, voice.spoken, settings.locale]);

  // Voice ends when the app leaves the screen: no microphone in the background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background" && current.current) {
        stop();
        setEnded("background");
      }
    });
    return () => {
      sub.remove();
      stop();
    };
  }, [stop]);

  const setMuted = (m: boolean) => {
    mutedRef.current = m;
    setMutedState(m);
    current.current?.setMuted(m);
  };

  return {
    mode,
    status,
    muted,
    userSpeaking,
    problem,
    ended,
    captions,
    levels,
    conversationId,
    start,
    stop,
    setMuted,
    interrupt: () => current.current?.interrupt(),
    sendText: (t: string) => current.current?.sendText(t),
    active: () => Boolean(current.current),
  };
}
