import { useState } from "react";
import {
  SERVICE_STATUSES,
  type PortfolioItem,
  type Service,
  type ServiceCreate,
  type ServiceUpdate,
  type Worker,
} from "@virtual-ai-office/shared";
import {
  createService,
  deleteService,
  listServices,
  listWorkers,
  updateService,
} from "../api";
import { useResource } from "../useResource";
import {
  ConfirmDialog,
  Empty,
  Field,
  FormError,
  PageHeader,
  StatusPill,
  toast,
} from "../ui";

// ---------------------------------------------------------------------------
// Portfolio editor
// ---------------------------------------------------------------------------

function PortfolioEditor({
  items,
  onChange,
}: {
  items: PortfolioItem[];
  onChange: (items: PortfolioItem[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const add = () => {
    if (!title.trim() || !url.trim()) return;
    onChange([
      ...items,
      {
        title: title.trim(),
        url: url.trim(),
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      },
    ]);
    setTitle("");
    setUrl("");
    setImageUrl("");
  };

  return (
    <div className="admin-portfolio">
      {items.map((p, i) => (
        <div key={`${p.url}-${i}`} className="admin-portfolio-item">
          <div>
            <strong>{p.title}</strong>
            <div className="muted small">
              <a href={p.url} target="_blank" rel="noreferrer">
                {p.url}
              </a>
            </div>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <div className="admin-grid-3">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="text"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <input
          type="text"
          placeholder="Image URL (optional)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
      </div>
      <button type="button" className="btn" onClick={add}>
        Add portfolio item
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service form
// ---------------------------------------------------------------------------

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;

function ServiceForm({
  service,
  workers,
  onSaved,
  onCancel,
}: {
  service: Service | null;
  workers: Worker[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = service !== null;
  const [id, setId] = useState(service?.id ?? "");
  const [title, setTitle] = useState(service?.title ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [workerId, setWorkerId] = useState(service?.workerId ?? "");
  const [price, setPrice] = useState(String(service?.price ?? 0));
  const [currency, setCurrency] = useState(service?.currency ?? "USD");
  const [deliveryEstimate, setDeliveryEstimate] = useState(
    service?.deliveryEstimate ?? "",
  );
  const [inputRequirements, setInputRequirements] = useState(
    service?.inputRequirements ?? "",
  );
  const [revisionPolicy, setRevisionPolicy] = useState(
    service?.revisionPolicy ?? "",
  );
  const [status, setStatus] = useState<string>(service?.status ?? "draft");
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(
    service?.portfolio ?? [],
  );
  const [aiDisclosure, setAiDisclosure] = useState(service?.aiDisclosure ?? "");
  const [sortOrder, setSortOrder] = useState(String(service?.sortOrder ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(null);
    if (!isEdit && (!id || !ID_RE.test(id))) {
      setError("id is required and must be URL-safe (a-z, 0-9, -, _).");
      return;
    }
    if (!title.trim()) {
      setError("title is required.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description,
        workerId: workerId || null,
        price: Number.parseFloat(price) || 0,
        currency: currency.toUpperCase().slice(0, 3) || "USD",
        deliveryEstimate,
        inputRequirements,
        revisionPolicy,
        status,
        portfolio,
        aiDisclosure,
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
      };
      if (isEdit && service) {
        await updateService(service.id, body as ServiceUpdate);
        toast("Service updated", "ok");
      } else {
        await createService({ id, ...(body as Omit<ServiceCreate, "id">) });
        toast("Service created", "ok");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-form">
      <FormError error={error} />
      <div className="admin-grid-2">
        <div>
          {isEdit ? (
            <Field label="Service id">
              <input type="text" value={service.id} readOnly disabled />
            </Field>
          ) : (
            <Field label="Service id" hint="URL-safe, permanent.">
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. deep-research"
              />
            </Field>
          )}
          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </Field>
          <Field label="Worker">
            <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              <option value="">— unassigned —</option>
              {workers
                .filter((w) => !w.archived)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.displayName} ({w.id})
                  </option>
                ))}
            </select>
          </Field>
          <div className="admin-grid-2">
            <Field label="Price">
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <Field label="Currency (3 letters)">
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                maxLength={3}
              />
            </Field>
          </div>
          <Field label="Delivery estimate">
            <input
              type="text"
              value={deliveryEstimate}
              onChange={(e) => setDeliveryEstimate(e.target.value)}
              placeholder="e.g. 2–3 business days"
            />
          </Field>
        </div>
        <div>
          <Field label="Input requirements">
            <textarea
              value={inputRequirements}
              onChange={(e) => setInputRequirements(e.target.value)}
              rows={3}
            />
          </Field>
          <Field label="Revision policy">
            <textarea
              value={revisionPolicy}
              onChange={(e) => setRevisionPolicy(e.target.value)}
              rows={3}
            />
          </Field>
          <Field
            label="AI disclosure"
            hint="Required when the work is AI-generated or needs human review."
          >
            <textarea
              value={aiDisclosure}
              onChange={(e) => setAiDisclosure(e.target.value)}
              rows={3}
              placeholder="e.g. Drafted by an AI agent, reviewed by a human editor."
            />
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {SERVICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="hint">Only “published” services appear publicly.</span>
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </Field>
        </div>
      </div>
      <h3>Portfolio</h3>
      <PortfolioEditor items={portfolio} onChange={setPortfolio} />
      <div className="admin-form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : isEdit ? "Save service" : "Create service"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Services page
// ---------------------------------------------------------------------------

export function ServicesPage() {
  const servicesRes = useResource(listServices);
  const workersRes = useResource(listWorkers);
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [confirming, setConfirming] = useState<Service | null>(null);
  const [busy, setBusy] = useState(false);

  const services = servicesRes.data?.services ?? [];
  const workers = workersRes.data?.workers ?? [];

  const remove = async (s: Service) => {
    setBusy(true);
    try {
      await deleteService(s.id);
      toast(`Service "${s.title}" deleted`, "ok");
      servicesRes.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), "err");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  const workerName = (id: string | null) =>
    workers.find((w) => w.id === id)?.displayName ?? id ?? "—";

  if (editing) {
    return (
      <div className="admin-page">
        <PageHeader
          title={editing === "new" ? "New service" : `Edit ${editing.title}`}
          actions={
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              ← Back to list
            </button>
          }
        />
        <div className="admin-panel">
          <ServiceForm
            service={editing === "new" ? null : editing}
            workers={workers}
            onSaved={() => {
              setEditing(null);
              servicesRes.refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageHeader
        title="Services"
        sub={`${services.length} services in the catalog.`}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing("new")}
          >
            + New service
          </button>
        }
      />
      {servicesRes.loading ? (
        <p className="muted">Loading…</p>
      ) : servicesRes.error ? (
        <p className="error-text" role="alert">
          {servicesRes.error}
        </p>
      ) : services.length === 0 ? (
        <Empty text="No services yet. Create the first one." />
      ) : (
        <div className="admin-panel">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Worker</th>
                <th>Price</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.title}</strong>
                    <div className="muted small">
                      <code>{s.id}</code>
                    </div>
                  </td>
                  <td>{workerName(s.workerId)}</td>
                  <td>
                    {s.price} {s.currency}
                  </td>
                  <td>
                    <StatusPill
                      text={s.status}
                      tone={s.status === "published" ? "ok" : "warn"}
                    />
                  </td>
                  <td className="admin-row-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditing(s)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setConfirming(s)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          title="Delete service?"
          body={
            <p>
              <strong>{confirming.title}</strong> (<code>{confirming.id}</code>)
              will be removed from the catalog. This cannot be undone.
            </p>
          }
          confirmLabel="Delete service"
          busy={busy}
          onConfirm={() => remove(confirming)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
