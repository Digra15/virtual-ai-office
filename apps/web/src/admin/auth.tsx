import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AdminUser } from "@virtual-ai-office/shared";
import { backendEnv } from "../env";
import { ApiError, apiLogin, apiLogout, apiMe } from "./api";

export interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  /** False when VITE_API_URL is not set — the admin UI cannot work at all. */
  backendReady: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const backendReady = backendEnv.configured;

  const refresh = useCallback(async () => {
    if (!backendEnv.configured) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { user } = await apiMe();
      setUser(user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        // Backend unreachable or misconfigured — surface as logged-out and
        // let the page show the error state; never swallow silently.
        console.warn("[admin] auth/me failed:", err);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const { user } = await apiLogin({ username, password });
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch (err) {
      // The session cookie may already be gone; local sign-out always wins.
      console.warn("[admin] logout request failed:", err);
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, backendReady, login, logout, refresh }),
    [user, loading, backendReady, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
