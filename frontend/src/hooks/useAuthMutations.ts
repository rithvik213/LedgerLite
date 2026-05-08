import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../api/auth';
import { apiClient } from '../api/client';
import { useAuthStore } from '../auth/store';
import type { LoginFormValues, RegisterFormValues } from '../lib/schemas/auth';
import type { UserResponse } from '../types/auth';

/**
 * Handles login: POST credentials → fetch user profile → store auth state → navigate home.
 * We call /me explicitly with the token attached as a header rather than via the
 * store-driven request interceptor, so the store is never written to until both
 * token and user are in hand. Otherwise a transient `{ token, user: null }` state
 * leaks to subscribers (and persists to localStorage) if /me fails or races.
 */
export function useLoginMutation() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (values: LoginFormValues) => {
      const authResponse = await login(values);
      const userResp = await apiClient.get<UserResponse>('/api/auth/me', {
        headers: { Authorization: `Bearer ${authResponse.token}` },
      });
      return { token: authResponse.token, user: userResp.data };
    },
    onSuccess: ({ token, user }) => {
      setAuth(token, user);
      navigate('/');
    },
  });
}

/**
 * Handles registration: POST new account → navigate to login with a success flag.
 * Does NOT auto-login — the backend issues no token on register.
 */
export function useRegisterMutation() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (values: RegisterFormValues) => register(values),
    onSuccess: () => {
      navigate('/login', { state: { registered: true } });
    },
  });
}
