import { useMemo } from "react";
import { useAgentStore } from "../../stores/useAgentStore";

/** Four headline numbers: total agents, online, working, errors. */
export function StatCards() {
  const agents = useAgentStore((s) => s.agents);
  const stats = useMemo(() => {
    const list = Object.values(agents);
    return {
      total: list.length,
      online: list.filter((a) => a.status !== "offline").length,
      working: list.filter((a) => a.status === "working").length,
      errors: list.filter((a) => a.status === "error").length,
    };
  }, [agents]);

  return (
    <section className="stat-cards" aria-label="Agent statistics">
      <div className="stat-card">
        <div className="label">Total</div>
        <div className="value">{stats.total}</div>
      </div>
      <div className="stat-card">
        <div className="label">Online</div>
        <div className="value">{stats.online}</div>
      </div>
      <div className="stat-card">
        <div className="label">Working</div>
        <div className="value">{stats.working}</div>
      </div>
      <div className="stat-card errors">
        <div className="label">Errors</div>
        <div className="value">{stats.errors}</div>
      </div>
    </section>
  );
}
