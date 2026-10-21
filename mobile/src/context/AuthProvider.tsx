import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, initApi, onUnauthorized, setToken } from '@/lib/api';
import type { User } from '@/lib/types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  studentId: string;
  university?: string;
  course?: string;
  yearOfStudy?: string;
}

interface AuthState {
  user: User | null;
  /** true until the saved session (if any) has been checked with the server */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await setToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  // Restore the saved session on app start.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await initApi();
      if (saved) {
        try {
          const r = await api.get<{ user: User }>('/auth/me');
          if (!cancelled) setUser(r.user);
        } catch (e) {
          // Only a 401 means the session is dead. If the server is just unreachable, stay signed out
          // for now but keep the token so the next launch (once the server is up) can restore it.
          if ((e as { status?: number }).status === 401) await setToken(null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Any API call that comes back 401 (expired token) signs the user out.
  useEffect(() => {
    onUnauthorized(() => void logout());
    return () => onUnauthorized(null);
  }, [logout]);

  const accept = useCallback(
    async (r: { token: string; user: User }) => {
      await setToken(r.token);
      qc.clear();
      setUser(r.user);
      return r.user;
    },
    [qc],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      logout,
      login: async (email, password) => accept(await api.post('/auth/login', { email, password })),
      register: async (input) => accept(await api.post('/auth/register', input)),
    }),
    [user, loading, logout, accept],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
