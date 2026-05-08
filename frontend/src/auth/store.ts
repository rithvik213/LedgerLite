import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserResponse } from '../types/auth';

/**
 * Token storage tradeoff: we persist the JWT in localStorage for simplicity.
 * localStorage is accessible to any JS running on the page, making it
 * vulnerable to XSS. The production-correct approach is an httpOnly cookie
 * set by the server so JS cannot read it at all. For this demo, localStorage
 * is acceptable because the threat surface is controlled, but it must never
 * be used for high-value tokens in a real deployment.
 */

const TOKEN_KEY = 'ledgerlite.token';

interface AuthState {
  token: string | null;
  user: UserResponse | null;
  setAuth: (token: string, user: UserResponse) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => {
        set({ token: null, user: null });
        // Belt-and-suspenders: persist middleware writes nulls back to
        // localStorage, but explicitly removing the key leaves no residue
        // for browser extensions or XSS payloads to inspect post-logout.
        localStorage.removeItem(TOKEN_KEY);
      },
    }),
    {
      name: TOKEN_KEY,
      // Only persist the token and user; actions are recreated each hydration.
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
