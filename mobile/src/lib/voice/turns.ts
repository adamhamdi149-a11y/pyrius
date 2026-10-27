import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioRecorder } from "expo-audio";
import type { VoiceCallbacks, VoiceEngine } from "./types";

/** dBFS from the recorder → 0–1. */
const level = (db?: number) => (db === undefined ? 0 : Math.max(0, Math.min(1, (db + 55) / 50)));
const SPEECH = 0.3;
const END_SILENCE_MS = 1100;
const MAX_TURN_MS = 30_000;
const IDLE_RESTART_MS = 20_000;

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
  private closed = false;
  private muted = false;
  private busy = false;

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

  private async listen() {
    if (this.closed || this.muted) return;
    const r = this.deps.recorder;
    try {
      await r.prepareToRecordAsync();
      r.record();
    } catch {
      this.cb.onError("The microphone couldn't start.", "permission");
      return;
    }
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
    this.clearPoll();
    await this.deps.recorder.stop().catch(() => {});
    this.listen();
  }

  private async endTurn() {
    this.clearPoll();
    this.cb.onUserSpeaking(false);
    this.cb.onStatus("thinking");
    await this.deps.recorder.stop().catch(() => {});
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
        const audio = await this.deps.speak(reply);
        if (audio && !this.closed) return this.play(audio);
      }
    } catch (e) {
      this.cb.onError((e as Error).message, "server");
    } finally {
      this.busy = false;
    }
    this.listen();
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

  private finishSpeaking() {
    this.player?.remove();
    this.player = null;
    this.cb.onLevels(0, 0);
    this.listen();
  }

  interrupt() {
    if (!this.player) return;
    this.player.pause();
    this.finishSpeaking();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) {
      this.clearPoll();
      this.deps.recorder.stop().catch(() => {});
      this.cb.onLevels(0, 0);
    } else if (!this.player && !this.busy) {
      this.listen();
    }
  }

  async sendText(text: string) {
    this.clearPoll();
    await this.deps.recorder.stop().catch(() => {});
    this.player?.pause();
    this.player?.remove();
    this.player = null;
    await this.respond(text, true);
  }

  stop() {
    this.closed = true;
    this.clearPoll();
    this.deps.recorder.stop().catch(() => {});
    this.player?.remove();
    this.player = null;
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  }
}
