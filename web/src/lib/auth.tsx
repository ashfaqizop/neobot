/**
 * Auth/session context. Establishes "who am I" via `GET /api/auth/me`, exposes
 * login/logout, and captures a token-URL (`?token=`) deep link on boot so a
 * shared link authenticates without a password. A global 401 handler clears the
 * user so route guards bounce to the login screen.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, setAccessToken, setUnauthorizedHandler } from './api.ts';
import { setSocketToken } from './socket.ts';
import type { AuthUser } from './types.ts';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  hasToken: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Capture a token-URL access token once at module load (before any request).
const bootToken = new URLSearchParams(window.location.search).get('token');
if (bootToken) {
  setAccessToken(bootToken);
  setSocketToken(bootToken);
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const me = await api.me();
      setUser(me);
    } catch (err) {
      const denied = err instanceof ApiError && (err.status === 401 || err.status === 403);
      // A token-URL visitor has no session cookie, so `/me` 401s. Validate the
      // token against a protected endpoint instead and grant shared access.
      if (denied && bootToken) {
        try {
          await api.state();
          setUser({ username: 'shared access' });
        } catch {
          setUser(null);
        }
      } else if (denied) {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    void refresh();
    return () => setUnauthorizedHandler(null);
  }, [refresh]);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    const res = await api.login(username, password);
    setUser({ username: res.username });
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, hasToken: Boolean(bootToken), login, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
