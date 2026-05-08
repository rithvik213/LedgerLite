import { createContext, useContext, type ReactNode } from 'react';
import { useAuthStore } from './store';
import { isTokenValid } from './jwt';
import type { UserResponse } from '../types/auth';

interface AuthContextValue {
  token: string | null;
  user: UserResponse | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: UserResponse) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { token, user, setAuth, clearAuth } = useAuthStore();

  // Treat an expired token the same as no token — avoids stale sessions
  // persisting across restarts without requiring an explicit logout.
  const isAuthenticated = isTokenValid(token);

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
