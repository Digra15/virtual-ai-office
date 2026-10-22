/**
 * Shared admin UI primitives. Styles live in index.css under .admin-*;
 * this file is intentionally dependency-free (React only).
 */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Field: label + input + optional hint/error
// ---------------------------------------------------------------------------

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
      {error && (
        <span className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog: modal for destructive operations
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  danger = true,
  onConfirm,
  onCancel,
  busy = false,
}: {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{title}</h2>
        <div className="muted">{body}</div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Toast: lightweight transient notification (no library)
// ---------------------------------------------------------------------------

let toastSeq = 0;
interface ToastItem {
  id: number;
  text: string;
  kind: "ok" | "err";
}

function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string; kind: "ok" | "err" }>).detail;
      const id = ++toastSeq;
      setItems((prev) => [...prev, { id, text: detail.text, kind: detail.kind }]);
      window.setTimeout(
        () => setItems((prev) => prev.filter((t) => t.id !== id)),
        4000,
      );
    };
    window.addEventListener("admin-toast", onToast);
    return () => window.removeEventListener("admin-toast", onToast);
  }, []);
  return createPortal(
    <div className="admin-toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`admin-toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function toast(text: string, kind: "ok" | "err" = "ok") {
  window.dispatchEvent(new CustomEvent("admin-toast", { detail: { text, kind } }));
}

export function AdminToasts() {
  return <ToastHost />;
}

// ---------------------------------------------------------------------------
// Misc small primitives
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-page-header">
      <div>
        <h2>{title}</h2>
        {sub && <p className="muted">{sub}</p>}
      </div>
      <div className="admin-page-actions">{actions}</div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

export function StatusPill({ text, tone }: { text: string; tone?: string }) {
  return <span className={`status-pill${tone ? ` pill-${tone}` : ""}`}>{text}</span>;
}

export function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="error-text" role="alert" style={{ marginBottom: 8 }}>
      {error}
    </div>
  );
}
