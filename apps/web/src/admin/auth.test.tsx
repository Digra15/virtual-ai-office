import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth";
import { ApiError } from "./api";

vi.mock("./api", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./api")>();
  return {
    ...orig,
    apiMe: vi.fn(),
    apiLogin: vi.fn(),
    apiLogout: vi.fn(),
  };
});

vi.mock("../env", () => ({
  backendEnv: { configured: true, apiUrl: "http://localhost:4000", wsUrl: "" },
}));

import { apiLogin, apiLogout, apiMe } from "./api";

const meMock = vi.mocked(apiMe);
const loginMock = vi.mocked(apiLogin);
const logoutMock = vi.mocked(apiLogout);

const USER = {
  id: "u1",
  username: "boss",
  role: "admin",
  createdAt: "2026-10-22T00:00:00Z",
  lastLoginAt: null,
} as const;

function Probe() {
  const { user, loading, backendReady } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="backendReady">{String(backendReady)}</span>
      <span data-testid="username">{user?.username ?? "none"}</span>
    </div>
  );
}

function LoginProbe() {
  const { login, logout, user } = useAuth();
  return (
    <div>
      <button
        type="button"
        onClick={() => login("boss", "supersecretpassword")}
      >
        login
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
      <span data-testid="username">{user?.username ?? "none"}</span>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("AuthProvider", () => {
  it("loads the current user via me() on mount", async () => {
    meMock.mockResolvedValue({ user: { ...USER } });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("loading").textContent).toBe("true");
    await waitFor(() =>
      expect(screen.getByTestId("username").textContent).toBe("boss"),
    );
    expect(meMock).toHaveBeenCalledTimes(1);
  });

  it("treats 401 from me() as logged out, not an error", async () => {
    meMock.mockRejectedValue(new ApiError(401, "unauthorized"));
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );
    expect(screen.getByTestId("username").textContent).toBe("none");
  });

  it("login() calls the API and stores the user", async () => {
    meMock.mockRejectedValue(new ApiError(401, "unauthorized"));
    loginMock.mockResolvedValue({ user: { ...USER } });
    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("username").textContent).toBe("none"),
    );
    screen.getByText("login").click();
    await waitFor(() =>
      expect(screen.getByTestId("username").textContent).toBe("boss"),
    );
    expect(loginMock).toHaveBeenCalledWith({
      username: "boss",
      password: "supersecretpassword",
    });
  });

  it("logout() clears the user even if the API call fails", async () => {
    meMock.mockResolvedValue({ user: { ...USER } });
    logoutMock.mockRejectedValue(new Error("network down"));
    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("username").textContent).toBe("boss"),
    );
    screen.getByText("logout").click();
    await waitFor(() =>
      expect(screen.getByTestId("username").textContent).toBe("none"),
    );
  });

  it("propagates login failures to the caller", async () => {
    meMock.mockRejectedValue(new ApiError(401, "unauthorized"));
    loginMock.mockRejectedValue(new ApiError(401, "bad credentials"));
    let caught: unknown = null;
    function ThrowProbe() {
      const { login } = useAuth();
      return (
        <button
          type="button"
          onClick={() => login("boss", "wrong").catch((e) => (caught = e))}
        >
          login
        </button>
      );
    }
    render(
      <AuthProvider>
        <ThrowProbe />
      </AuthProvider>,
    );
    screen.getByText("login").click();
    await waitFor(() => expect(caught).toBeInstanceOf(ApiError));
  });
});
