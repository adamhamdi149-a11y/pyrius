"use client";
import { ArrowUp, Briefcase, CalendarRange, Check, Mic, PlaneTakeoff, SlidersHorizontal, Square } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useDismiss } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { useStore } from "@/lib/store/AppStore";
import type { TripPreferences } from "@/lib/types";

export interface ComposerHandle {
  focus: () => void;
  setText: (t: string) => void;
}

type QuickPrefs = Pick<TripPreferences, "nonstopOnly" | "carryOnOnly" | "flexibleDates">;

/** Visible composer state; mirrors the real request lifecycle. */
export type ComposerState = "idle" | "listening" | "processing" | "success" | "error";

interface Props {
  onSend: (text: string) => void;
  busy: boolean;
  followUp: boolean;
  prefs: QuickPrefs;
  onPrefsChange: (p: QuickPrefs) => void;
  onListeningChange?: (on: boolean) => void;
  state: ComposerState;
  /** Where the live orb docks inside the composer. */
  orbSlot?: Ref<HTMLSpanElement>;
  /** Example requests that cycle as a placeholder on the welcome screen. */
  examples?: string[];
  /** True while the live orb sits in the composer. */
  docked?: boolean;
  /** Called when the composer goes from empty to having text, and back. */
  onDraftChange?: (hasText: boolean) => void;
}

// Minimal typing for the Web Speech API (not in lib.dom for all browsers).
interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ onSend, busy, followUp, prefs, onPrefsChange, onListeningChange, state, orbSlot, examples, docked, onDraftChange }, ref) {
  const { t, settings } = useStore();
  const toast = useToast();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [voice, setVoice] = useState<boolean | null>(null);
  const [focused, setFocused] = useState(false);
  const [example, setExample] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const rec = useRef<SpeechRec | null>(null);
  const base = useRef("");
  const popRef = useDismiss(prefsOpen, () => setPrefsOpen(false));

  useImperativeHandle(ref, () => ({
    focus: () => area.current?.focus(),
    setText: (v: string) => {
      setText(v);
      requestAnimationFrame(() => area.current?.focus());
    },
  }));

  // Auto-grow the textarea up to its max height.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  useEffect(() => onListeningChange?.(listening), [listening, onListeningChange]);
  const hasText = text.trim().length > 0;
  useEffect(() => onDraftChange?.(hasText), [hasText, onDraftChange]);

  // Voice is offered only where the browser can actually do it.
  useEffect(() => {
    const W = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setVoice(Boolean(W.SpeechRecognition ?? W.webkitSpeechRecognition));
  }, []);

  // Cycle example requests while the welcome composer is empty and idle.
  const showExamples = Boolean(examples?.length) && !followUp && !text && !listening && !focused;
  useEffect(() => {
    if (!showExamples || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setExample((i) => (i + 1) % examples!.length), 3600);
    return () => clearInterval(id);
  }, [showExamples, examples]);
  useEffect(() => () => rec.current?.abort(), []);

  const submit = () => {
    const v = text.trim();
    if (!v || busy) return;
    rec.current?.stop();
    onSend(v);
    setText("");
  };

  const toggleVoice = useCallback(() => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      toast({ tone: "info", title: t("composer.voiceUnsupported") });
      return;
    }
    const r = new Ctor();
    r.lang = settings.locale === "fr" ? "fr-CA" : "en-CA";
    r.interimResults = true;
    r.continuous = false;
    base.current = text ? text.trimEnd() + " " : "";
    r.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      setText(base.current + said);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast({ tone: "error", title: t("composer.voiceDenied") });
      else if (e.error === "no-speech") toast({ tone: "info", title: "I didn't catch anything. Try again when you're ready." });
      else if (e.error !== "aborted") toast({ tone: "error", title: "Voice input stopped unexpectedly.", description: e.error });
    };
    r.onend = () => {
      setListening(false);
      area.current?.focus();
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      toast({ tone: "error", title: "Voice input couldn't start." });
    }
  }, [listening, settings.locale, t, text, toast]);

  const activePrefs = [prefs.nonstopOnly, prefs.carryOnOnly, prefs.flexibleDates].filter(Boolean).length;
  const ready = text.trim().length > 0 && !busy;

  return (
    <div className="composer" data-listening={listening} data-state={listening ? "listening" : state} data-focused={focused} data-docked={docked ?? followUp}>
      <span className="composer__ring" aria-hidden="true" />
      <label htmlFor="composer-input" className="sr-only">
        {t("composer.placeholder")}
      </label>
      <textarea
        id="composer-input"
        ref={area}
        className="composer__input"
        rows={1}
        value={text}
        placeholder={showExamples ? "" : listening ? t("composer.listening") : followUp ? t("composer.placeholderFollow") : t("composer.placeholder")}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        maxLength={2000}
        enterKeyHint="send"
        aria-describedby="composer-hint"
      />
      {showExamples && (
        <span className="composer__example" aria-hidden="true" key={example}>
          {examples![example]}
        </span>
      )}
      <div className="composer__row">
        <span className="composer__orb" ref={orbSlot} aria-hidden="true" />
        <div style={{ position: "relative" }} ref={popRef}>
          <button type="button" className="composer__tool" aria-expanded={prefsOpen} aria-haspopup="dialog" onClick={() => setPrefsOpen((o) => !o)} title={t("composer.prefs")}>
            <SlidersHorizontal />
            <span>{t("composer.prefs")}</span>
            {activePrefs > 0 && <b>{activePrefs}</b>}
          </button>
          {prefsOpen && (
            <div className="popover prefs-pop" role="dialog" aria-label={t("composer.prefs")}>
              <div className="prefs-pop__title">{t("composer.prefs")}</div>
              <div className="prefs-pop__sub">Applied to this trip. The assistant won&apos;t ask again.</div>
              {(
                [
                  ["nonstopOnly", "Nonstop flights only", PlaneTakeoff],
                  ["carryOnOnly", "Carry-on included", Briefcase],
                  ["flexibleDates", "My dates are flexible", CalendarRange],
                ] as const
              ).map(([key, label, Icon]) => (
                <button type="button" role="switch" aria-checked={Boolean(prefs[key])} className="toggle-row" key={key} onClick={() => onPrefsChange({ ...prefs, [key]: !prefs[key] })}>
                  <span>
                    <Icon />
                    {label}
                  </span>
                  <i className="switch" data-on={Boolean(prefs[key])} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
        {listening && (
          <span className="wave" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
        <div className="composer__spacer" />
        {voice && (
        <button
          type="button"
          className="icon-btn composer__mic"
          data-on={listening}
          onClick={toggleVoice}
          aria-label={listening ? t("composer.micStop") : t("composer.mic")}
          aria-pressed={listening}
          title={listening ? t("composer.micStop") : t("composer.mic")}
        >
          {listening ? <Square style={{ width: 14, height: 14 }} fill="currentColor" /> : <Mic />}
        </button>
        )}
        <button type="button" className="composer__send" data-ready={ready} disabled={!ready} onClick={submit} aria-label={t("composer.send")}>
          {busy ? <span className="composer__spinner" /> : state === "success" && !text ? <Check strokeWidth={2.4} className="composer__ok" /> : <ArrowUp strokeWidth={2.4} />}
        </button>
      </div>
      <span id="composer-hint" className="sr-only">
        {t("composer.hint")}
      </span>
    </div>
  );
});
