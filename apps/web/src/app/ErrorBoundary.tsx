import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Top-level crash guard: renders a fallback with a reset instead of a blank page. */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
        console.error("[ErrorBoundary]", error);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="error-fallback" role="alert">
          <h2>Something went wrong</h2>
          <p>
            The dashboard hit an unexpected error:{" "}
            {this.state.error.message || "unknown error"}. Your agent data is
            safe on the backend — this is a display problem only.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn"
              onClick={this.handleReset}
              aria-label="Try rendering again"
            >
              Try again
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={this.handleReload}
              aria-label="Reload the page"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
