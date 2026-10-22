import { useEffect, useState } from "react";
import { ORDER_STATES } from "@virtual-ai-office/shared";
import {
  getHealth,
  listAudit,
  listOrders,
  listServices,
  listWorkers,
} from "../api";
import { useResource } from "../useResource";
import { Empty, PageHeader, StatusPill } from "../ui";
import type { AdminPage } from "./types";

function useHealth() {
  const [health, setHealth] = useState<{ ok: boolean; text: string }>({
    ok: false,
    text: "checking…",
  });
  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((h) => {
        if (!cancelled) {
          const ok =
            typeof h === "object" &&
            h !== null &&
            (h as { status?: string }).status === "ok";
          setHealth({
            ok,
            text: ok ? `ok — ${(h as { agentCount?: number }).agentCount ?? "?"} agents` : "unexpected response",
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setHealth({
            ok: false,
            text: err instanceof Error ? err.message : "unreachable",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return health;
}

export function DashboardPage({ go }: { go: (p: AdminPage) => void }) {
  const workers = useResource(listWorkers);
  const services = useResource(listServices);
  const orders = useResource(listOrders);
  const audit = useResource(() => listAudit(8));
  const health = useHealth();

  const w = workers.data?.workers ?? [];
  const s = services.data?.services ?? [];
  const o = orders.data?.orders ?? [];
  const byStatus = new Map<string, number>();
  for (const order of o) byStatus.set(order.status, (byStatus.get(order.status) ?? 0) + 1);

  return (
    <div className="admin-page">
      <PageHeader title="Dashboard" sub="Fleet overview at a glance." />
      <div className="admin-cards">
        <div className="stat-card">
          <span className="k">Workers</span>
          <span className="v">
            {workers.loading ? "…" : w.filter((x) => !x.archived).length}
          </span>
          <span className="hint">
            {w.filter((x) => x.archived).length} archived
          </span>
        </div>
        <div className="stat-card">
          <span className="k">Services</span>
          <span className="v">{services.loading ? "…" : s.length}</span>
          <span className="hint">
            {s.filter((x) => x.status === "published").length} published
          </span>
        </div>
        <div className="stat-card">
          <span className="k">Orders</span>
          <span className="v">{orders.loading ? "…" : o.length}</span>
          <span className="hint">
            {ORDER_STATES.filter((st) => byStatus.get(st))
              .map((st) => `${st}: ${byStatus.get(st)}`)
              .join(" · ") || "none"}
          </span>
        </div>
        <div className="stat-card">
          <span className="k">Backend health</span>
          <span className="v">
            <StatusPill text={health.ok ? "healthy" : "down"} tone={health.ok ? "ok" : "bad"} />
          </span>
          <span className="hint">{health.text}</span>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-panel">
          <h3>Quick links</h3>
          <div className="admin-quick-links">
            <button type="button" className="btn" onClick={() => go("workers")}>
              Manage workers
            </button>
            <button type="button" className="btn" onClick={() => go("services")}>
              Manage services
            </button>
            <button type="button" className="btn" onClick={() => go("orders")}>
              Review orders
            </button>
            <button type="button" className="btn" onClick={() => go("office")}>
              Office config
            </button>
          </div>
          {(workers.error || services.error || orders.error) && (
            <p className="error-text" role="alert">
              Some data failed to load:{" "}
              {[workers.error, services.error, orders.error].filter(Boolean).join(" · ")}
            </p>
          )}
        </section>
        <section className="admin-panel">
          <h3>Recent activity</h3>
          {audit.loading ? (
            <p className="muted">Loading…</p>
          ) : audit.data && audit.data.entries.length > 0 ? (
            <ul className="admin-activity-list">
              {audit.data.entries.map((e) => (
                <li key={e.id}>
                  <code>{new Date(e.at).toLocaleString()}</code>{" "}
                  <strong>{e.actor}</strong> {e.action}{" "}
                  <span className="muted">
                    {e.entity}/{e.entityId}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="No audit entries yet." />
          )}
        </section>
      </div>
    </div>
  );
}
