/** Suspense fallback shown while the 3D office (and its fonts) load. */
export function LoadingOverlay() {
  return (
    <div className="loading-overlay" role="status" aria-label="Loading 3D office">
      <div className="spinner" aria-hidden="true" />
      <span>Loading 3D office…</span>
    </div>
  );
}
