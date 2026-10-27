/** What the voice screen shows. Each state is driven by a real event from the session, never a timer. */
export type VoiceStatus = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "reconnecting" | "ended" | "error";

export interface TranscriptLine {
  id: string;
  role: "user" | "assistant";
  text: string;
  final: boolean;
  /** Already stored in the conversation by the engine itself (take-turns mode). */
  persisted?: boolean;
  /** Typed in the voice screen rather than spoken. */
  typed?: boolean;
}

export interface VoiceSession {
  client_secret: string;
  max_seconds: number;
}

export interface VoiceCallbacks {
  onStatus: (s: VoiceStatus) => void;
  onUserSpeaking: (on: boolean) => void;
  onTranscript: (line: TranscriptLine) => void;
  onLevels: (input: number, output: number) => void;
  /** Runs a tool call through the Pyrius server; returns the JSON string for the model. */
  onToolCall: (call: { call_id: string; name: string; arguments: string }) => Promise<string>;
  onError: (message: string, kind: "connection" | "server" | "permission" | "offline") => void;
  onEnded: (reason: "limit" | "expired" | "background") => void;
}

export interface VoiceEngine {
  readonly kind: "live" | "turns";
  start(): Promise<void>;
  stop(): void;
  setMuted(muted: boolean): void;
  interrupt(): void;
  sendText(text: string): void;
}
