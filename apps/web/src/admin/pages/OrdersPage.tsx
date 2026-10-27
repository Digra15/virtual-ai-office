import { useMemo, useState } from "react";
import {
  ORDER_STATES,
  ORDER_TRANSITIONS,
  type Order,
  type OrderState,
} from "@virtual-ai-office/shared";
import {
  getOrder,
  listOrders,
  markOrderPaid,
  transitionOrder,
} from "../api";
import { useResource } from "../useResource";
import {
  Empty,
  Field,
  FormError,
  PageHeader,
  StatusPill,
  toast,
} from "../ui";

const STATUS_TONES: Record<OrderState, string> = {
  pending: "warn",
  accepted: "",
  queued: "",
  in_progress: "info",
  review: "info",
  completed: "ok",
  cancelled: "bad",
  failed: "bad",
};

// ---------------------------------------------------------------------------
// Order detail
// ---------------------------------------------------------------------------

function MarkPaidForm({
  order,
  onDone,
  onCancel,
}: {
  order: Order;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [provider, setProvider] = useState("");
  const [providerRef, setProviderRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError(null);
    if (!provider.trim() || !providerRef.trim()) {
      setError("Provider and provider reference are both required.");
      return;
    }
    setSaving(true);
    try {
      await markOrderPaid(order.id, {
        provider: provider.trim(),
        providerRef: providerRef.trim(),
      });
      toast("Order marked as paid", "ok");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <h4>Mark order as paid</h4>
      <p className="warn-text" role="note">
        ⚠️ Only set when a verified payment provider confirms the payment —
        this is a manual stub until webhooks are wired. The paid flag can
        never be edited directly.
      </p>
      <FormError error={error} />
      <Field label="Payment provider" hint='e.g. "stripe".'>
        <input
          type="text"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder="stripe"
        />
      </Field>
      <Field label="Provider reference" hint="Charge / payment-intent id.">
        <input
          type="text"
          value={providerRef}
          onChange={(e) => setProviderRef(e.target.value)}
          placeholder="pi_…"
        />
      </Field>
      <div className="admin-form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={saving}
        >
          {saving ? "Saving…" : "Confirm payment"}
        </button>
      </div>
    </div>
  );
}

function TransitionButtons({
  order,
  onDone,
}: {
  order: Order;
  onDone: () => void;
}) {
  const targets = ORDER_TRANSITIONS[order.status] ?? [];
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (to: OrderState) => {
    setError(null);
    setBusy(to);
    try {
      await transitionOrder(order.id, { to, note });
      toast(`Order → ${to}`, "ok");
      setNote("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (targets.length === 0) {
    return <p className="muted">Terminal state — no transitions available.</p>;
  }

  return (
    <div>
      <FormError error={error} />
      <Field label="Transition note (optional)">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why is this changing state?"
        />
      </Field>
      <div className="admin-btn-row">
        {targets.map((to) => (
          <button
            key={to}
            type="button"
            className="btn"
            disabled={busy !== null}
            onClick={() => go(to)}
            data-testid={`transition-${to}`}
          >
            {busy === to ? "…" : `→ ${to}`}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OrderDetail({
  orderId,
  onBack,
  onChanged,
}: {
  orderId: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [markingPaid, setMarkingPaid] = useState(false);
  const orderRes = useResource(useMemo(() => () => getOrder(orderId), [orderId]));
  const order = orderRes.data?.order;

  const refresh = () => {
    orderRes.refresh();
    onChanged();
  };

  return (
    <div className="admin-page">
      <PageHeader
        title={`Order ${orderId}`}
        actions={
          <button type="button" className="btn" onClick={onBack}>
            ← Back to orders
          </button>
        }
      />
      {orderRes.loading ? (
        <p className="muted">Loading…</p>
      ) : orderRes.error || !order ? (
        <p className="error-text" role="alert">
          {orderRes.error ?? "Order not found."}
        </p>
      ) : (
        <>
          <div className="admin-grid-2">
            <div className="admin-panel">
              <h3>Customer</h3>
              <div className="detail-row">
                <span className="k">Name</span>
                <span className="v">{order.customerName || "—"}</span>
              </div>
              <div className="detail-row">
                <span className="k">Contact</span>
                <span className="v">{order.customerContact || "—"}</span>
              </div>
              <p className="hint">🔒 Admin only — never exposed publicly.</p>
              <div className="detail-row">
                <span className="k">Status</span>
                <span className="v">
                  <StatusPill text={order.status} tone={STATUS_TONES[order.status]} />
                </span>
              </div>
              <div className="detail-row">
                <span className="k">Service</span>
                <span className="v">
                  <code>{order.serviceId}</code>
                </span>
              </div>
              <div className="detail-row">
                <span className="k">Worker</span>
                <span className="v">{order.workerId ? <code>{order.workerId}</code> : "—"}</span>
              </div>
              <div className="detail-row">
                <span className="k">Review</span>
                <span className="v">
                  {order.reviewState}
                  {order.reviewNote && (
                    <span className="muted"> — {order.reviewNote}</span>
                  )}
                </span>
              </div>
            </div>
            <div className="admin-panel">
              <h3>Payment</h3>
              {order.paid ? (
                <>
                  <StatusPill text="PAID" tone="ok" />
                  <div className="detail-row">
                    <span className="k">Reference</span>
                    <span className="v">
                      <code>{order.paymentRef ?? "—"}</code>
                    </span>
                  </div>
                  <p className="hint">
                    The paid flag can only be set through the verified payment
                    path — it cannot be edited or unset here.
                  </p>
                </>
              ) : markingPaid ? (
                <MarkPaidForm
                  order={order}
                  onDone={() => {
                    setMarkingPaid(false);
                    refresh();
                  }}
                  onCancel={() => setMarkingPaid(false)}
                />
              ) : (
                <>
                  <StatusPill text="UNPAID" tone="warn" />
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setMarkingPaid(true)}
                    >
                      Mark paid…
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="admin-panel">
            <h3>Brief</h3>
            {/*
              The customer brief is rendered as PLAIN TEXT — never HTML.
              React escapes text children by default; dangerouslySetInnerHTML
              is never used here.
            */}
            <pre className="order-brief">{order.brief || "—"}</pre>
            {order.attachments.length > 0 && (
              <>
                <h4>Attachments</h4>
                <ul>
                  {order.attachments.map((a) => (
                    <li key={a.url}>
                      <a href={a.url} target="_blank" rel="noreferrer">
                        {a.name}
                      </a>{" "}
                      <span className="muted small">
                        ({a.mime}, {(a.size / 1024).toFixed(1)} KB)
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {order.deliverables.length > 0 && (
            <div className="admin-panel">
              <h3>Deliverables</h3>
              <ul>
                {order.deliverables.map((d) => (
                  <li key={d.url}>
                    <a href={d.url} target="_blank" rel="noreferrer">
                      {d.title}
                    </a>{" "}
                    <span className="muted small">
                      {new Date(d.at).toLocaleString()}
                      {d.note && ` — ${d.note}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="admin-panel">
            <h3>State transitions</h3>
            <TransitionButtons order={order} onDone={refresh} />
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders list page
// ---------------------------------------------------------------------------

export function OrdersPage() {
  const ordersRes = useResource(listOrders);
  const [filter, setFilter] = useState<OrderState | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const orders = ordersRes.data?.orders ?? [];
  const filtered =
    filter === "all" ? orders : orders.filter((o) => o.status === filter);

  if (selectedId) {
    return (
      <OrderDetail
        orderId={selectedId}
        onBack={() => setSelectedId(null)}
        onChanged={ordersRes.refresh}
      />
    );
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Orders"
        sub={`${orders.length} orders. State changes go through the transition buttons only.`}
      />
      <div className="chip-row" role="group" aria-label="Filter by status">
        <button
          type="button"
          className={`chip${filter === "all" ? " active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        {ORDER_STATES.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip${filter === s ? " active" : ""}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {ordersRes.loading ? (
        <p className="muted">Loading…</p>
      ) : ordersRes.error ? (
        <p className="error-text" role="alert">
          {ordersRes.error}
        </p>
      ) : filtered.length === 0 ? (
        <Empty text="No orders match this filter." />
      ) : (
        <div className="admin-panel">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Paid</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => setSelectedId(o.id)}
                      >
                        <code>{o.id}</code>
                      </button>
                    </td>
                    <td>{o.customerName || "—"}</td>
                    <td>
                      <code>{o.serviceId}</code>
                    </td>
                    <td>
                      <StatusPill text={o.status} tone={STATUS_TONES[o.status]} />
                    </td>
                    <td>{o.paid ? "✓" : "—"}</td>
                    <td className="muted small">
                      {new Date(o.createdAt).toLocaleString()}
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
