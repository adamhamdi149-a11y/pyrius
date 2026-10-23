"use client";
import { AlertTriangle, Bookmark, Check, Info } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/utils";

type Tone = "success" | "info" | "error" | "save";
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
  leaving?: boolean;
}

const Ctx = createContext<(t: Omit<ToastItem, "id" | "tone"> & { tone?: Tone }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((l) => l.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 220);
  }, []);

  const push = useCallback(
    (t: Omit<ToastItem, "id" | "tone"> & { tone?: Tone }) => {
      const id = ++seq.current;
      setItems((l) => [...l.slice(-2), { ...t, tone: t.tone ?? "success", id }]);
      setTimeout(() => dismiss(id), t.action ? 5200 : 3400);
    },
    [dismiss],
  );

  const Icon = { success: Check, info: Info, error: AlertTriangle, save: Bookmark };

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => {
          const I = Icon[t.tone];
          return (
            <div key={t.id} className={cx("toast", `toast--${t.tone}`)} data-leaving={t.leaving}>
              <span className="toast__icon">
                <I />
              </span>
              <div className="toast__body">
                <div className="toast__title">{t.title}</div>
                {t.description && <div className="toast__desc">{t.description}</div>}
              </div>
              {t.action && (
                <button
                  className="toast__action"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
