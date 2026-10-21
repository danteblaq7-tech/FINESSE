import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore, UNAUTHORIZED_EVENT } from '@/lib/api';
import type { User } from '@/lib/types';

export interface RegisterInput {
  name: string; email: string; password: string; studentId: string;
  university?: string; course?: string; yearOfStudy?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => !!tokenStore.get());

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    qc.clear();
  }, [qc]);

  // Restore the session on first load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    api.get<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  // Any API call that comes back 401 (expired token) signs the user out.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const accept = useCallback((r: { token: string; user: User }) => {
    tokenStore.set(r.token);
    qc.clear();
    setUser(r.user);
    return r.user;
  }, [qc]);

  const value = useMemo<AuthState>(
    () => ({
      user, loading, logout,
      login: async (email, password) => accept(await api.post('/auth/login', { email, password })),
      register: async (input) => accept(await api.post('/auth/register', input)),
    }),
    [user, loading, logout, accept],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
