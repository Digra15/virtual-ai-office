import { useEffect, useState } from "react";
import type { GuestThread } from "@virtual-ai-office/shared";
import { listGuestThreads, replyGuestChat } from "../api";
import { useResource } from "../useResource";
import { Empty, PageHeader } from "../ui";

const REFRESH_MS = 15_000;

function unansweredCount(thread: GuestThread): number {
  let lastReplyIdx = -1;
  thread.messages.forEach((m, i) => {
    if (m.from !== "guest") lastReplyIdx = i;
  });
  return thread.messages.filter((m, i) => m.from === "guest" && i > lastReplyIdx).length;
}

/**
 * Guest chat inbox: visitor threads addressed to Difia, with an admin
 * reply box. Replies sent here come from "admin" (not Difia); Difia's own
 * replies arrive via the poller. Auto-refreshes every 15 seconds.
 */
export function GuestChatPage() {
  const threadsRes = useResource(() => listGuestThreads());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => threadsRes.refresh(), REFRESH_MS);
    return () => window.clearInterval(t);
  }, [threadsRes.refresh]);

  const threads = threadsRes.data?.threads ?? [];
  const selected = threads.find((t) => t.guestId === selectedId) ?? null;

  const sendReply = async (messageId: string) => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await replyGuestChat(messageId, text.slice(0, 1000));
      setDraft("");
      await threadsRes.refresh();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Gagal mengirim balasan");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="Pesan Tamu"
        sub="Chat pengunjung untuk Difia. Balasan dari sini dikirim sebagai Admin; balasan Difia datang lewat poller."
        actions={
          <button type="button" className="btn" onClick={threadsRes.refresh}>
            Refresh now
          </button>
        }
      />
      {threadsRes.loading && threads.length === 0 ? (
        <p className="muted">Loading…</p>
      ) : threadsRes.error ? (
        <p className="error-text" role="alert">
          {threadsRes.error}
        </p>
      ) : threads.length === 0 ? (
        <Empty text="Belum ada pesan tamu." />
      ) : selected ? (
        <div>
          <button type="button" className="link-btn" onClick={() => setSelectedId(null)}>
            ← Kembali ke daftar
          </button>
          <h3>
            {selected.guestName} <span className="muted small">({selected.guestId})</span>
          </h3>
          <div className="admin-panel">
            {selected.messages.map((m) => (
              <p key={m.id} className="small">
                <span className="muted">{new Date(m.at).toLocaleString()} · </span>
                <strong>{m.from === "guest" ? m.guestName : m.from === "difia" ? "Difia" : "Admin"}: </strong>
                {m.text}
              </p>
            ))}
          </div>
          {(() => {
            const pending = [...selected.messages].reverse().find((m) => m.from === "guest");
            if (!pending) return null;
            return (
              <div>
                <textarea
                  value={draft}
                  maxLength={1000}
                  rows={3}
                  style={{ width: "100%", boxSizing: "border-box" }}
                  placeholder="Balas sebagai Admin…"
                  onChange={(e) => setDraft(e.target.value)}
                />
                {sendError && (
                  <p className="error-text" role="alert">
                    {sendError}
                  </p>
                )}
                <button
                  type="button"
                  className="btn"
                  disabled={sending || draft.trim() === ""}
                  onClick={() => void sendReply(pending.id)}
                >
                  Kirim balasan
                </button>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="admin-panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tamu</th>
                  <th>Terakhir</th>
                  <th>Belum dibalas</th>
                  <th>Pesan terakhir</th>
                </tr>
              </thead>
              <tbody>
                {threads.map((t) => {
                  const last = t.messages[t.messages.length - 1];
                  return (
                    <tr key={t.guestId}>
                      <td>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => setSelectedId(t.guestId)}
                        >
                          {t.guestName}
                        </button>
                        <div className="muted small">{t.guestId}</div>
                      </td>
                      <td className="muted small">{new Date(t.updatedAt).toLocaleString()}</td>
                      <td>{unansweredCount(t)}</td>
                      <td className="small">{last ? last.text : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
