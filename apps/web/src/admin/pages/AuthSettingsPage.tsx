import { useAuth } from "../auth";
import { PageHeader } from "../ui";

/**
 * Auth settings. The backend exposes no password-change or session-list
 * endpoints, so this page only shows what the API supports — the current
 * user card — plus honest documentation for secret rotation.
 */
export function AuthSettingsPage() {
  const { user } = useAuth();

  return (
    <div className="admin-page">
      <PageHeader title="Auth" sub="Session and credential management." />
      <div className="admin-panel">
        <h3>Current user</h3>
        {user ? (
          <>
            <div className="detail-row">
              <span className="k">Username</span>
              <span className="v">{user.username}</span>
            </div>
            <div className="detail-row">
              <span className="k">Role</span>
              <span className="v">{user.role}</span>
            </div>
            <div className="detail-row">
              <span className="k">Created</span>
              <span className="v">
                {new Date(user.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="detail-row">
              <span className="k">Last login</span>
              <span className="v">
                {user.lastLoginAt
                  ? new Date(user.lastLoginAt).toLocaleString()
                  : "—"}
              </span>
            </div>
          </>
        ) : (
          <p className="muted">Not signed in.</p>
        )}
      </div>

      <div className="admin-panel">
        <h3>Change password</h3>
        <p className="muted">
          Password change is not available through the API yet — the control
          is intentionally disabled rather than faked.
        </p>
        <button type="button" className="btn" disabled title="Not available via the API">
          Change password (unavailable)
        </button>
      </div>

      <div className="admin-panel">
        <h3>Secret rotation</h3>
        <p className="muted">
          The setup token and internal secrets live in the Worker's secret
          store, never in this frontend. Rotate them with wrangler:
        </p>
        <pre className="admin-json">
{`# rotate the one-time admin setup token
wrangler secret put SETUP_TOKEN

# rotate the internal service secret (if the Worker uses one)
wrangler secret put INTERNAL_SECRET`}
        </pre>
        <p className="hint">
          After rotating, redeploy the Worker for the new values to take
          effect. Sessions are httpOnly cookies — JavaScript (and this page)
          never sees them.
        </p>
      </div>
    </div>
  );
}
