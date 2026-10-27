import { useEffect, useState } from "react";
import { listAudit } from "../api";
import { useResource } from "../useResource";
import { Empty, PageHeader } from "../ui";

const REFRESH_MS = 15_000;

export function ActivityPage() {
  const auditRes = useResource(() => listAudit(100));
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => auditRes.refresh(), REFRESH_MS);
    return () => window.clearInterval(t);
  }, [auditRes.refresh]);

  const entries = auditRes.data?.entries ?? [];

  return (
    <div className="admin-page">
      <PageHeader
        title="Activity"
        sub="Audit log of admin actions. Auto-refreshes every 15 seconds."
        actions={
          <button type="button" className="btn" onClick={auditRes.refresh}>
            Refresh now
          </button>
        }
      />
      {auditRes.loading && entries.length === 0 ? (
        <p className="muted">Loading…</p>
      ) : auditRes.error ? (
        <p className="error-text" role="alert">
          {auditRes.error}
        </p>
      ) : entries.length === 0 ? (
        <Empty text="No audit entries yet." />
      ) : (
        <div className="admin-panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="muted small">
                      {new Date(e.at).toLocaleString()}
                    </td>
                    <td>{e.actor}</td>
                    <td>
                      <code>{e.action}</code>
                    </td>
                    <td>
                      <span className="muted">{e.entity}</span>/
                      <code>{e.entityId}</code>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() =>
                          setOpenId((prev) => (prev === e.id ? null : e.id))
                        }
                      >
                        {openId === e.id ? "hide" : "show"}
                      </button>
                      {openId === e.id && (
                        <pre className="admin-json">
                          {JSON.stringify(e.detail, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
