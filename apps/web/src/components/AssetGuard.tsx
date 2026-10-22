import { Component, type ReactNode } from "react";

interface AssetGuardProps {
  /** Human-readable asset name shown if loading fails. */
  label: string;
  fallback?: ReactNode;
  children: ReactNode;
}

interface AssetGuardState {
  failed: boolean;
  message: string;
}

/**
 * Error boundary for (possibly lazy) 3D content. All current office assets
 * are procedural — nothing external is loaded — so this exists to guard
 * future/optional external models (e.g. a rigged character replacing the
 * procedural pixel AgentAvatar) without taking down the whole dashboard.
 */
class AssetErrorBoundary extends Component<AssetGuardProps, AssetGuardState> {
  state: AssetGuardState = { failed: false, message: "" };

  static getDerivedStateFromError(error: unknown): AssetGuardState {
    return {
      failed: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
        console.warn(`[AssetGuard:${this.props.label}] asset failed:`, error);
  }

  render() {
    if (this.state.failed) {
      return (
        this.props.fallback ?? (
          <div className="asset-guard-fallback" role="alert">
            <strong>{this.props.label}</strong>
            <span>
              3D asset failed to load
              {this.state.message ? `: ${this.state.message}` : ""}. The 2D
              dashboard remains fully usable.
            </span>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export function AssetGuard({ label, fallback, children }: AssetGuardProps) {
  return (
    <AssetErrorBoundary label={label} fallback={fallback}>
      {children}
    </AssetErrorBoundary>
  );
}
