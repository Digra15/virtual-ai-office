import { useCallback, useEffect, useRef, useState } from "react";
import type { GuestChatMessage } from "@virtual-ai-office/shared";
import { backendEnv } from "../../env";

const GUEST_ID_KEY = "vao-guest-id";
const GUEST_NAME_KEY = "vao-guest-name";
const GREETED_KEY = "vao-guest-greeted";
const POLL_MS = 15_000;

/**
 * Visitor chat with Difia the receptionist (no login). The greeting is
 * client-side only — it is never stored as a server message. Replies come
 * from Difia (the main assistant) via the poller, so they arrive within
 * minutes, not seconds: the panel says so honestly while a guest message
 * is still unanswered. A failed send is reported, never faked as sent.
 */
export const DIFIA_GREETING =
  "Halo! Selamat datang di Virtual AI Office. Saya Difia, resepsionis di sini. Ada yang bisa saya bantu?";

function getOrCreateGuestId(): string {
  try {
    const existing = window.localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;
    const bytes = new Uint8Array(8);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const id = `guest-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
    window.localStorage.setItem(GUEST_ID_KEY, id);
    return id;
  } catch {
    return `guest-${Math.floor(Math.random() * 1e12).toString(36)}`;
  }
}

function loadName(): string {
  try {
    return window.localStorage.getItem(GUEST_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function hasUnansweredGuestMessage(messages: GuestChatMessage[]): boolean {
  let lastReplyIdx = -1;
  messages.forEach((m, i) => {
    if (m.from !== "guest") lastReplyIdx = i;
  });
  return messages.some((m, i) => m.from === "guest" && i > lastReplyIdx);
}

export function GuestChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<GuestChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState(loadName);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGreeting, setShowGreeting] = useState(false);
  const guestIdRef = useRef<string>("");
  if (!guestIdRef.current) guestIdRef.current = getOrCreateGuestId();
  const listRef = useRef<HTMLDivElement>(null);

  const fetchThread = useCallback(async () => {
    try {
      const res = await fetch(
        `${backendEnv.apiUrl}/api/guest-chat?guestId=${encodeURIComponent(guestIdRef.current)}`,
      );
      if (!res.ok) {
        setError("Pesan belum terkirim, coba lagi nanti");
        return;
      }
      const data = (await res.json()) as {
        thread?: { messages?: GuestChatMessage[] };
      };
      setMessages(data.thread?.messages ?? []);
      setError(null);
    } catch {
      setError("Pesan belum terkirim, coba lagi nanti");
    }
  }, []);

  // Poll while the panel is open; first open also shows Difia's greeting.
  useEffect(() => {
    if (!open) return;
    try {
      if (!window.localStorage.getItem(GREETED_KEY)) {
        setShowGreeting(true);
        window.localStorage.setItem(GREETED_KEY, "1");
      }
    } catch {
      setShowGreeting(true);
    }
    void fetchThread();
    const timer = window.setInterval(() => void fetchThread(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [open, fetchThread]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, showGreeting, open]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${backendEnv.apiUrl}/api/guest-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId: guestIdRef.current,
          ...(name.trim() ? { guestName: name.trim().slice(0, 40) } : {}),
          text: text.slice(0, 1000),
        }),
      });
      if (!res.ok) {
        setError("Pesan belum terkirim, coba lagi nanti");
        return;
      }
      setDraft("");
      await fetchThread();
    } catch {
      setError("Pesan belum terkirim, coba lagi nanti");
    } finally {
      setSending(false);
    }
  }, [draft, name, sending, fetchThread]);

  const awaitingReply = hasUnansweredGuestMessage(messages);

  return (
    <div className="guest-chat">
      {open && (
        <div className="guest-chat-panel" role="dialog" aria-label="Chat dengan Difia">
          <div className="guest-chat-header">
            <span className="guest-chat-title">💬 Difia — Resepsionis</span>
            <button
              type="button"
              className="guest-chat-close"
              aria-label="Tutup chat"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </div>
          <div className="guest-chat-list" ref={listRef}>
            {showGreeting && (
              <div className="guest-chat-msg guest-chat-msg-difia">
                <span className="guest-chat-sender">Difia</span>
                <span>{DIFIA_GREETING}</span>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`guest-chat-msg ${
                  m.from === "guest" ? "guest-chat-msg-guest" : "guest-chat-msg-difia"
                }`}
              >
                <span className="guest-chat-sender">
                  {m.from === "guest" ? m.guestName : m.from === "difia" ? "Difia" : "Admin"}
                </span>
                <span>{m.text}</span>
              </div>
            ))}
            {messages.length === 0 && !showGreeting && (
              <p className="muted small">Belum ada pesan.</p>
            )}
          </div>
          {awaitingReply && (
            <p className="guest-chat-pending" role="status">
              Difia akan membalas dalam beberapa menit
            </p>
          )}
          {error && (
            <p className="guest-chat-error" role="alert">
              {error}
            </p>
          )}
          <div className="guest-chat-form">
            <input
              type="text"
              className="guest-chat-name"
              placeholder="Nama (opsional)"
              value={name}
              maxLength={40}
              onChange={(e) => {
                setName(e.target.value);
                try {
                  window.localStorage.setItem(GUEST_NAME_KEY, e.target.value);
                } catch {
                  /* private mode — name just stays for this session */
                }
              }}
              aria-label="Nama (opsional)"
            />
            <div className="guest-chat-row">
              <input
                type="text"
                className="guest-chat-input"
                placeholder="Tulis pesan untuk Difia…"
                value={draft}
                maxLength={1000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
                aria-label="Pesan untuk Difia"
              />
              <button
                type="button"
                className="btn guest-chat-send"
                disabled={sending || draft.trim() === ""}
                onClick={() => void send()}
              >
                Kirim
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        type="button"
        className="guest-chat-fab"
        aria-label="Chat dengan Difia"
        onClick={() => setOpen((v) => !v)}
      >
        💬
      </button>
    </div>
  );
}
