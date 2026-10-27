import { loadWebRTC, playRemote, speaker, stopRemote } from "./native";
import type { VoiceCallbacks, VoiceEngine, VoiceSession } from "./types";

type Pc = InstanceType<NonNullable<ReturnType<typeof loadWebRTC>>["RTCPeerConnection"]>;
type ServerEvent = { type: string; [k: string]: unknown };
type ToolCall = { call_id: string; name: string; arguments: string };

const CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export const liveVoiceAvailable = () => loadWebRTC() !== null;

/**
 * Live speech-to-speech with OpenAI's Realtime API over WebRTC. The microphone and Pyrius's voice
 * travel as audio tracks (with the phone's echo cancellation); events, transcripts and tool calls
 * travel on the data channel. Tool calls are run by the app through the Pyrius server, never here.
 */
export class RealtimeVoice implements VoiceEngine {
  readonly kind = "live" as const;
  private pc: Pc | null = null;
  private dc: ReturnType<Pc["createDataChannel"]> | null = null;
  private mic: { getTracks(): { stop(): void; enabled: boolean }[] } | null = null;
  private stats: ReturnType<typeof setInterval> | null = null;
  private limit: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private speaking = false;
  /** Tool calls run one after another, so a search sees the trip update made just before it. */
  private queue: Promise<unknown> = Promise.resolve();
  private started = new Map<string, Promise<string>>();
  private answered = new Set<string>();
  private responded = new Set<string>();
  private partials = new Map<string, string>();

  constructor(private cb: VoiceCallbacks, private openSession: () => Promise<VoiceSession>) {}

  async start() {
    const rtc = loadWebRTC();
    if (!rtc) throw Object.assign(new Error("Live voice needs the Pyrius app build."), { code: "unsupported" });
    this.cb.onStatus("connecting");

    const session = await this.openSession();
    if (this.closed) return;

    const stream = await rtc.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as unknown as boolean, video: false });
    if (this.closed) return stream.getTracks().forEach((t) => t.stop());
    this.mic = stream;

    const pc = new rtc.RTCPeerConnection({});
    this.pc = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.addEventListener("track", (e: { streams?: unknown[] }) => playRemote(e.streams?.[0]));
    pc.addEventListener("connectionstatechange", () => {
      const st = pc.connectionState;
      if (st === "connected") this.cb.onStatus(this.speaking ? "speaking" : "listening");
      else if (st === "disconnected") this.cb.onStatus("reconnecting");
      else if (st === "failed" && !this.closed) this.cb.onError("The connection dropped.", "connection");
    });

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    dc.addEventListener("message", (e) => {
      if (typeof e.data !== "string") return;
      try {
        this.onEvent(JSON.parse(e.data) as ServerEvent);
      } catch {}
    });

    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    let res: Response;
    try {
      res = await fetch(CALLS_URL, { method: "POST", body: offer.sdp, headers: { Authorization: `Bearer ${session.client_secret}`, "Content-Type": "application/sdp" } });
    } catch {
      throw Object.assign(new Error("Can't reach the voice service. Check your connection."), { code: "offline" });
    }
    if (!res.ok) throw Object.assign(new Error("The voice session couldn't start. Please try again."), { code: "unavailable" });
    const answer = await res.text();
    if (this.closed) return;
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
    speaker(true);

    this.limit = setTimeout(() => this.cb.onEnded("limit"), session.max_seconds * 1000);
    this.stats = setInterval(() => this.readLevels(), 110);
  }

  /** Audio levels from WebRTC's own statistics: the real microphone and the real voice coming back. */
  private async readLevels() {
    const pc = this.pc;
    if (!pc) return;
    try {
      const report = (await pc.getStats()) as Map<string, { type: string; kind?: string; audioLevel?: number }>;
      let input = 0;
      let output = 0;
      report.forEach((r) => {
        if (r.kind !== "audio" || typeof r.audioLevel !== "number") return;
        if (r.type === "media-source") input = r.audioLevel;
        if (r.type === "inbound-rtp") output = r.audioLevel;
      });
      this.cb.onLevels(input, output);
    } catch {}
  }

  private send(event: Record<string, unknown>) {
    if (this.dc && this.dc.readyState === "open") this.dc.send(JSON.stringify(event));
  }

  private onEvent(e: ServerEvent) {
    const str = (k: string) => (typeof e[k] === "string" ? (e[k] as string) : "");
    switch (e.type) {
      case "session.created":
      case "session.updated":
        this.cb.onStatus("listening");
        break;
      case "input_audio_buffer.speech_started":
        this.cb.onStatus("listening");
        this.cb.onUserSpeaking(true);
        break;
      case "input_audio_buffer.speech_stopped":
        this.cb.onUserSpeaking(false);
        this.cb.onStatus("thinking");
        break;
      case "conversation.item.input_audio_transcription.delta": {
        const id = str("item_id");
        const text = (this.partials.get(id) ?? "") + str("delta");
        this.partials.set(id, text);
        this.cb.onTranscript({ id, role: "user", text, final: false });
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const id = str("item_id");
        this.partials.delete(id);
        this.cb.onTranscript({ id, role: "user", text: str("transcript").trim(), final: true });
        break;
      }
      case "response.created":
        this.cb.onStatus("thinking");
        break;
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
      case "response.output_text.delta":
      case "response.text.delta": {
        const id = str("item_id") || str("response_id");
        const text = (this.partials.get(id) ?? "") + str("delta");
        this.partials.set(id, text);
        this.cb.onTranscript({ id, role: "assistant", text, final: false });
        break;
      }
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
      case "response.output_text.done":
      case "response.text.done": {
        const id = str("item_id") || str("response_id");
        const text = (str("transcript") || str("text") || this.partials.get(id) || "").trim();
        this.partials.delete(id);
        this.cb.onTranscript({ id, role: "assistant", text, final: true });
        break;
      }
      case "output_audio_buffer.started":
        this.speaking = true;
        this.cb.onStatus("speaking");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        this.speaking = false;
        this.cb.onStatus("listening");
        break;
      case "response.function_call_arguments.done":
        this.runCall({ call_id: str("call_id"), name: str("name"), arguments: str("arguments") });
        break;
      case "response.done":
        this.onResponseDone(e.response as { id?: string; status?: string; output?: { type: string; call_id?: string; name?: string; arguments?: string }[]; status_details?: { error?: { message?: string } } });
        break;
      case "error": {
        const err = e.error as { message?: string; code?: string } | undefined;
        if (err?.code === "session_expired") this.cb.onEnded("expired");
        // Cancelling when nothing is playing is harmless; anything else is worth showing.
        else if (err?.code !== "response_cancel_not_active") this.cb.onError(err?.message ?? "Voice hit a problem.", "server");
        break;
      }
    }
  }

  private runCall(call: ToolCall) {
    if (!call.call_id || this.started.has(call.call_id)) return this.started.get(call.call_id);
    this.cb.onStatus("thinking");
    const p = (this.queue = this.queue.then(() => this.cb.onToolCall(call).catch(() => JSON.stringify({ ok: false, error: "The action failed. Tell the user and offer to try again." })))) as Promise<string>;
    this.started.set(call.call_id, p);
    return p;
  }

  private async onResponseDone(r: { id?: string; status?: string; output?: { type: string; call_id?: string; name?: string; arguments?: string }[]; status_details?: { error?: { message?: string } } } | undefined) {
    if (!r) return;
    if (r.status === "failed") this.cb.onError(r.status_details?.error?.message ?? "Pyrius couldn't answer that.", "server");
    const calls = (r.output ?? []).filter((o) => o.type === "function_call" && o.call_id && !this.answered.has(o.call_id));
    if (!calls.length) {
      if (!this.speaking) this.cb.onStatus("listening");
      return;
    }
    const outputs = await Promise.all(calls.map((c) => this.runCall({ call_id: c.call_id!, name: c.name ?? "", arguments: c.arguments ?? "{}" })));
    if (this.closed) return;
    calls.forEach((c, i) => {
      this.answered.add(c.call_id!);
      this.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: c.call_id, output: outputs[i] } });
    });
    // One follow-up answer per response, even if events repeat.
    const key = r.id ?? calls.map((c) => c.call_id).join(",");
    if (!this.responded.has(key)) {
      this.responded.add(key);
      this.send({ type: "response.create" });
    }
  }

  setMuted(muted: boolean) {
    this.mic?.getTracks().forEach((t) => (t.enabled = !muted));
  }

  /** Stops Pyrius mid-sentence and drops the rest of what it was saying. */
  interrupt() {
    this.send({ type: "response.cancel" });
    this.send({ type: "output_audio_buffer.clear" });
    this.speaking = false;
    this.cb.onStatus("listening");
  }

  /** A typed message inside the voice session; Pyrius answers it in the same conversation. */
  sendText(text: string) {
    this.send({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
    this.send({ type: "response.create" });
    this.cb.onTranscript({ id: `typed-${Date.now()}`, role: "user", text, final: true });
  }

  stop() {
    if (this.closed) return;
    this.closed = true;
    if (this.stats) clearInterval(this.stats);
    if (this.limit) clearTimeout(this.limit);
    try {
      this.dc?.close();
    } catch {}
    try {
      this.pc?.close();
    } catch {}
    this.mic?.getTracks().forEach((t) => t.stop());
    this.pc = null;
    this.dc = null;
    this.mic = null;
    stopRemote();
    speaker(false);
  }
}
