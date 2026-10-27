import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import { toast } from "~/components/Toast";
import { api, ApiError } from "./api";
import { useStore } from "./store";

const MAX_SECONDS = 60;
const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000, isMeteringEnabled: true };

export type DictationState = "idle" | "recording" | "transcribing";

/** Dbfs from the recorder → 0–1 for the bars. */
const level = (db?: number) => (db === undefined ? 0 : Math.max(0, Math.min(1, (db + 55) / 50)));

/**
 * The chat bar's microphone: record what the user says, transcribe it on the Pyrius server, and put
 * the text in the composer so they can check it before sending. Nothing is recorded until they tap.
 */
export function useDictation(onText: (text: string) => void) {
  const { L, settings } = useStore();
  const recorder = useAudioRecorder(OPTIONS);
  const [state, setState] = useState<DictationState>("idle");
  const [levels, setLevels] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRef = useRef<(send: boolean) => void>(() => {});

  const clear = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  const start = useCallback(async () => {
    if (state !== "idle") return;
    const perm = await requestRecordingPermissionsAsync().catch(() => null);
    if (!perm?.granted) {
      toast({
        tone: "error",
        title: L("Microphone access is off", "Micro désactivé"),
        description: L("Allow it in Settings to dictate.", "Autorisez-le dans les réglages pour dicter."),
        action: { label: L("Settings", "Réglages"), onPress: () => Linking.openSettings() },
      });
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState("recording");
      setLevels([]);
      setSeconds(0);
      const began = Date.now();
      timer.current = setInterval(() => {
        const st = recorder.getStatus();
        setLevels((l) => [...l.slice(-27), level(st.metering)]);
        const s = Math.floor((Date.now() - began) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stopRef.current(true);
      }, 100);
    } catch {
      clear();
      setState("idle");
      toast({ tone: "error", title: L("The microphone couldn't start", "Le micro n'a pas pu démarrer") });
    }
  }, [state, recorder, L]);

  const stop = useCallback(
    async (send: boolean) => {
      if (state !== "recording") return;
      clear();
      try {
        await recorder.stop();
      } catch {}
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      const uri = recorder.uri;
      if (!send || !uri) {
        setState("idle");
        return;
      }
      setState("transcribing");
      try {
        const form = new FormData();
        form.append("audio", { uri, name: "dictation.m4a", type: "audio/m4a" } as unknown as Blob);
        form.append("language", settings.locale);
        const { text } = await api<{ text: string }>("/api/voice/transcribe", undefined, { form });
        if (text) onText(text);
        else toast({ title: L("I didn't catch anything", "Je n'ai rien entendu"), description: L("Try again a little closer to the phone.", "Réessayez plus près du téléphone.") });
      } catch (e) {
        toast({ tone: "error", title: e instanceof ApiError ? e.message : L("Dictation failed", "La dictée a échoué") });
      } finally {
        setState("idle");
      }
    },
    [state, recorder, settings.locale, onText, L],
  );
  stopRef.current = stop;

  // Never leave the microphone on when the composer goes away.
  useEffect(() => () => clear(), []);

  return { state, levels, seconds, start, stop };
}
