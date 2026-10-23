"use client";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Bottom sheet presentation (used for mobile filters). */
  sheet?: boolean;
}

/** Accessible modal: focus is moved in, trapped, restored on close; Escape and backdrop close it. */
export function Dialog({ open, onClose, title, description, children, footer, wide, sheet }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusables = () =>
      Array.from(node?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(
        (el) => !el.hasAttribute("disabled"),
      );
    requestAnimationFrame(() => (focusables().find((el) => el.dataset.autofocus !== undefined) ?? focusables()[0])?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className={cx("overlay", sheet && "overlay--sheet")} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={cx(sheet ? "sheet" : "dialog", wide && "dialog--wide")} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {sheet && <div className="sheet__grip" />}
        <div className="dialog__head">
          <div style={{ flex: 1 }}>
            <h2 id={titleId} className="dialog__title">
              {title}
            </h2>
            {description && <div className="dialog__desc">{description}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        {children && <div className="dialog__body">{children}</div>}
        {footer && <div className="dialog__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className={cx("btn", danger ? "btn--danger" : "btn--primary")}
            data-autofocus
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}
