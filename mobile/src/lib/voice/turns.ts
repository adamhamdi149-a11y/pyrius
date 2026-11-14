import { createAudioPlayer, getRecordingPermissionsAsync, setAudioModeAsync, type AudioPlayer, type AudioRecorder } from "expo-audio";
import type { VoiceCallbacks, VoiceEngine } from "./types";

/** dBFS from the recorder → 0–1. */
const level = (db?: number) => (db === undefined ? 0 : Math.max(0, Math.min(1, (db + 55) / 50)));
const SPEECH = 0.3;
const END_SILENCE_MS = 800;
const MAX_TURN_MS = 30_000;
const IDLE_RESTART_MS = 20_000;

/**
 * A reply in two parts for speaking: the first sentence, which is ready to play quickly, and the
 * rest, synthesized while the first one plays.
 */
export function splitForSpeech(text: string): string[] {
  const t = text.trim();
  if (t.length < 140) return [t];
  const m = t.slice(0, 220).match(/^(.{25,}?[.!?…])\s+/s);
  if (!m) return [t];
  const rest = t.slice(m[0].length).trim();
  return rest ? [m[1], rest] : [t];
}

interface Deps {
  recorder: AudioRecorder;
  /** Speech to text on the Pyrius server. */
  transcribe: (uri: string) => Promise<string>;
  /** Runs the text concierge on the conversation (it stores both messages) and returns the reply. */
  answer: (text: string) => Promise<string | null>;
  /** Pyrius's reply as an audio file, or null when spoken replies are off. */
  speak: (text: string) => Promise<string | null>;
}

/**
 * Take-turns voice for builds without WebRTC (Expo Go): Pyrius listens until you pause, writes down
 * what you said, answers through the same concierge as the chat, and reads the answer aloud. The
 * microphone is off while Pyrius speaks, so there is no echo; tap to interrupt it.
 */
export class TurnVoice implements VoiceEngine {
  readonly kind = "turns" as const;
  private poll: ReturnType<typeof setInterval> | null = null;
  private player: AudioPlayer | null = null;
  /** Audio for the parts of the reply still to play, in order (being synthesized or ready). */
  private queue: Promise<string | null>[] = [];
  private closed = false;
  private muted = false;
  private busy = false;
  /** True while the recorder is prepared or recording. Android refuses to prepare it twice. */
  private listening = false;

  constructor(private cb: VoiceCallbacks, private deps: Deps) {}

  async start() {
    this.cb.onStatus("connecting");
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
    await this.listen();
  }

  private clearPoll() {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
  }

  /** Stops the recorder if it's on. Safe to call at any time. */
  private async release() {
    this.clearPoll();
    if (!this.listening) return;
    this.listening = false;
    await this.deps.recorder.stop().catch(() => {});
  }

  private async listen() {
    if (this.closed || this.muted || this.listening) return;
    this.listening = true;
    const r = this.deps.recorder;
    try {
      await r.prepareToRecordAsync();
      r.record();
    } catch {
      // A recorder left prepared (an earlier session or dictation) blocks a new one: release it and retry once.
      try {
        await r.stop().catch(() => {});
        await r.prepareToRecordAsync();
        r.record();
      } catch (e) {
        this.listening = false;
        const perm = await getRecordingPermissionsAsync().catch(() => null);
        if (perm && !perm.granted) this.cb.onError("Pyrius needs the microphone to talk with you.", "permission");
        else this.cb.onError(`The microphone couldn't start${__DEV__ ? ` (${(e as Error).message})` : ""}. Close other apps using it and try again.`, "connection");
        return;
      }
    }
    if (this.closed || this.muted) return this.release();
    this.cb.onStatus("listening");
    let heard = 0;
    let speaking = false;
    let silent = 0;
    const began = Date.now();
    this.clearPoll();
    this.poll = setInterval(() => {
      const v = level(r.getStatus().metering);
      this.cb.onLevels(v, 0);
      if (v > SPEECH) {
        heard += 1;
        silent = 0;
        if (heard >= 2 && !speaking) {
          speaking = true;
          this.cb.onUserSpeaking(true);
        }
      } else if (speaking) {
        silent += 100;
      }
      const long = Date.now() - began;
      if ((speaking && silent >= END_SILENCE_MS) || (speaking && long >= MAX_TURN_MS)) this.endTurn();
      else if (!speaking && long >= IDLE_RESTART_MS) this.restart();
    }, 100);
  }

  private async restart() {
    await this.release();
    this.listen();
  }

  private async endTurn() {
    this.cb.onUserSpeaking(false);
    this.cb.onStatus("thinking");
    await this.release();
    const uri = this.deps.recorder.uri;
    if (!uri || this.closed) return;
    let text = "";
    try {
      text = await this.deps.transcribe(uri);
    } catch (e) {
      this.cb.onError((e as Error).message, "server");
    }
    if (!text) return this.listen();
    await this.respond(text, false);
  }

  private async respond(text: string, typed: boolean) {
    if (this.closed || this.busy) return;
    this.busy = true;
    this.cb.onTranscript({ id: `u-${Date.now()}`, role: "user", text, final: true, persisted: true, typed });
    this.cb.onStatus("thinking");
    try {
      const reply = await this.deps.answer(text);
      if (this.closed) return;
      if (reply) {
        this.cb.onTranscript({ id: `a-${Date.now()}`, role: "assistant", text: reply, final: true, persisted: true });
        // All parts are requested at once; the first starts playing as soon as it's ready.
        let told = false;
        this.queue = splitForSpeech(reply).map((part) =>
          this.deps.speak(part).catch((e: Error) => {
            if (!told && !this.closed) this.cb.onError(e.message, "server");
            told = true;
            return null;
          }),
        );
        if (await this.playNext()) return;
      }
    } catch (e) {
      this.cb.onError((e as Error).message, "server");
    } finally {
      this.busy = false;
    }
    this.listen();
  }

  /** Plays the next part of the reply. False when there's nothing left to say. */
  private async playNext(): Promise<boolean> {
    while (this.queue.length) {
      const uri = await this.queue.shift()!;
      if (this.closed) return true;
      if (uri) {
        this.play(uri);
        return true;
      }
    }
    return false;
  }

  private play(uri: string) {
    const p = createAudioPlayer(uri);
    this.player = p;
    // The orb follows the real samples of Pyrius's voice where the platform provides them.
    if (p.isAudioSamplingSupported) {
      p.setAudioSamplingEnabled(true);
      p.addListener("audioSampleUpdate", (s) => {
        const frames = s.channels[0]?.frames ?? [];
        let sum = 0;
        for (let i = 0; i < frames.length; i += 4) sum += frames[i] * frames[i];
        this.cb.onLevels(0, Math.min(1, Math.sqrt(sum / Math.max(1, frames.length / 4)) * 3));
      });
    }
    p.addListener("playbackStatusUpdate", (st) => {
      if (st.didJustFinish) this.finishSpeaking();
    });
    this.cb.onStatus("speaking");
    p.play();
  }

  private async finishSpeaking() {
    this.player?.remove();
    this.player = null;
    if (await this.playNext()) return;
    this.cb.onLevels(0, 0);
    this.listen();
  }

  interrupt() {
    if (!this.player) return;
    this.queue = [];
    this.player.pause();
    this.finishSpeaking();
  }

  setMuted(muted: boolean) {
    if (muted === this.muted) return;
    this.muted = muted;
    if (muted) {
      this.release();
      this.cb.onLevels(0, 0);
    } else if (!this.player && !this.busy) {
      this.listen();
    }
  }

  async sendText(text: string) {
    this.queue = [];
    await this.release();
    this.player?.pause();
    this.player?.remove();
    this.player = null;
    await this.respond(text, true);
  }

  stop() {
    this.closed = true;
    this.queue = [];
    this.release();
    this.player?.remove();
    this.player = null;
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  }
}
