import { useState } from "react";
import { AdminSetupSchema } from "@virtual-ai-office/shared";
import { ApiError, apiSetup } from "./api";
import { AuthProvider, useAuth } from "./auth";
import { AdminLiveProvider } from "./live";
import { AdminToasts, Field, FormError, toast } from "./ui";
import { ADMIN_PAGES, type AdminPage } from "./pages/types";
import { DashboardPage } from "./pages/DashboardPage";
import { WorkersPage } from "./pages/WorkersPage";
import { ServicesPage } from "./pages/ServicesPage";
import { OrdersPage } from "./pages/OrdersPage";
import { OfficePage } from "./pages/OfficePage";
import { RoomsPage } from "./pages/RoomsPage";
import { RecoveryPage } from "./pages/RecoveryPage";
import { BrandingPage } from "./pages/BrandingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AssetsPage } from "./pages/AssetsPage";
import { ActivityPage } from "./pages/ActivityPage";
import { AuthSettingsPage } from "./pages/AuthSettingsPage";
import { MissionAgentsPage } from "./pages/MissionAgentsPage";
import { MissionKanbanPage } from "./pages/MissionKanbanPage";
import { MissionMeetingPage } from "./pages/MissionMeetingPage";
import { MissionSpawnPage } from "./pages/MissionSpawnPage";
import { MissionConnectionPage } from "./pages/MissionConnectionPage";
import { GuestChatPage } from "./pages/GuestChatPage";

// ---------------------------------------------------------------------------
// Backend not configured — honest setup guide, no mockups
// ---------------------------------------------------------------------------

function BackendSetupGuide() {
  return (
    <div className="admin-gate">
      <div className="admin-gate-card">
        <h1>Admin console unavailable</h1>
        <p>
          The admin UI talks to the Cloudflare Worker API, but no backend URL
          is configured. Set it and redeploy:
        </p>
        <ol className="admin-checklist-text">
          <li>
            Set <code>VITE_API_URL</code> to your Worker URL, e.g.{" "}
            <code>https://virtual-ai-office-api.&lt;subdomain&gt;.workers.dev</code>
            , and <code>VITE_WS_URL</code> to the matching{" "}
            <code>wss://…/ws</code> URL.
          </li>
          <li>
            Worker checklist: D1 database bound and migrations applied (
            <code>wrangler d1 migrations apply</code>), R2 bucket bound for
            asset uploads, <code>SETUP_TOKEN</code> set via{" "}
            <code>wrangler secret put SETUP_TOKEN</code>.
          </li>
          <li>Redeploy the Pages site and reload /admin.</li>
        </ol>
        <p className="muted">
          Nothing here is simulated — every admin action calls the real API.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// First-time setup
// ---------------------------------------------------------------------------

function SetupPage({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const parsed = AdminSetupSchema.safeParse({ username, password, setupToken });
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      );
      return;
    }
    setBusy(true);
    try {
      const { user } = await apiSetup(parsed.data);
      toast(`Welcome, ${user.username}`, "ok");
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(
          "Setup was rejected (403) — an admin account already exists. Log in instead.",
        );
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-gate">
      <div className="admin-gate-card">
        <h1>Set up admin access</h1>
        <p className="muted">
          First run: create the admin account. You need the{" "}
          <code>SETUP_TOKEN</code> secret from the Worker.
        </p>
        <FormError error={error} />
        <Field label="Username" hint="3–32 chars: letters, digits, - and _.">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </Field>
        <Field label="Password" hint="Minimum 12 characters.">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Setup token" hint="The SETUP_TOKEN secret on the Worker.">
          <input
            type="password"
            value={setupToken}
            onChange={(e) => setSetupToken(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <div className="admin-form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Creating…" : "Create admin account"}
          </button>
        </div>
        <p className="muted small">
          Already set up?{" "}
          <button type="button" className="link-btn" onClick={onDone}>
            Go to login
          </button>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function LoginPage({ onNeedSetup }: { onNeedSetup: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }
    setBusy(true);
    try {
      await login(username, password);
      toast("Signed in", "ok");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid username or password.");
      } else if (err instanceof ApiError && err.status === 429) {
        setError("Too many attempts — wait a bit and try again.");
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-gate">
      <div className="admin-gate-card">
        <h1>Admin sign in</h1>
        <FormError error={error} />
        <Field label="Username">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </Field>
        <div className="admin-form-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
        <p className="muted small">
          First time here?{" "}
          <button type="button" className="link-btn" onClick={onNeedSetup}>
            Initialize the admin account
          </button>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function Shell() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState<AdminPage>("dashboard");

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <h1>Office Admin</h1>
          <p>{user?.username}</p>
        </div>
        <nav aria-label="Admin sections">
          {ADMIN_PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`admin-nav-item${page === p.id ? " active" : ""}`}
              onClick={() => setPage(p.id)}
              aria-current={page === p.id ? "page" : undefined}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <a className="link-btn" href="/" target="_self">
            ← Public dashboard
          </a>
          <button type="button" className="btn" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        {page === "dashboard" && <DashboardPage go={setPage} />}
        {page === "workers" && <WorkersPage />}
        {page === "services" && <ServicesPage />}
        {page === "orders" && <OrdersPage />}
        {page === "office" && <OfficePage />}
        {page === "rooms" && <RoomsPage />}
        {page === "recovery" && <RecoveryPage />}
        {page === "branding" && <BrandingPage />}
        {page === "settings" && <SettingsPage />}
        {page === "assets" && <AssetsPage />}
        {page === "activity" && <ActivityPage />}
        {page === "auth" && <AuthSettingsPage />}
        {page === "mission-agents" && <MissionAgentsPage />}
        {page === "mission-kanban" && <MissionKanbanPage />}
        {page === "mission-meeting" && <MissionMeetingPage />}
        {page === "mission-spawn" && <MissionSpawnPage />}
        {page === "mission-connection" && <MissionConnectionPage />}
        {page === "guest-chat" && <GuestChatPage />}
      </main>
    </div>
  );
}

function Gated() {
  const { user, loading, backendReady, refresh } = useAuth();
  const [showSetup, setShowSetup] = useState(false);
  // Runtime settings are bearer-gated (sessionStorage token), not session
  // gated — so they stay reachable before the full admin backend (D1)
  // lands. Reading needs no token; only saving asks for one.
  const [showRuntimeSettings, setShowRuntimeSettings] = useState(false);

  if (!backendReady) return <BackendSetupGuide />;
  if (loading) return <div className="admin-gate"><p className="muted">Loading…</p></div>;
  if (showRuntimeSettings) {
    return (
      <div className="admin-shell">
        <main className="admin-main">
          <button
            type="button"
            className="link-btn"
            onClick={() => setShowRuntimeSettings(false)}
          >
            ← Kembali ke login admin
          </button>
          <SettingsPage />
        </main>
      </div>
    );
  }
  if (!user) {
    return (
      <>
        {showSetup ? (
          <SetupPage onDone={() => { setShowSetup(false); void refresh(); }} />
        ) : (
          <LoginPage onNeedSetup={() => setShowSetup(true)} />
        )}
        <div className="admin-gate">
          <p className="muted small">
            Pengaturan runtime tidak butuh login admin (pakai token, bukan
            sesi).{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => setShowRuntimeSettings(true)}
            >
              Buka Pengaturan runtime
            </button>
          </p>
        </div>
      </>
    );
  }
  return (
    <AdminLiveProvider>
      <Shell />
    </AdminLiveProvider>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminToasts />
      <Gated />
    </AuthProvider>
  );
}
