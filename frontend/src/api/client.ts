import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../auth/store';

// During development Vite proxies /api → http://localhost:8080, so we need
// no base URL. In production set VITE_API_BASE_URL to point at the gateway.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Paths that must not carry an Authorization header — the gateway's auth
// allow-list matches these exactly, and sending a stale token could cause
// unexpected 401s on the login page itself.
const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/register'];

// Match the path *exactly* (allowing a query string), not by prefix — a
// hypothetical future `/api/auth/login-sso` should NOT inherit public status.
function isPublicPath(url: string): boolean {
  const path = url.split('?', 1)[0];
  return PUBLIC_PATHS.includes(path);
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const url = config.url ?? '';
  const isPublic = isPublicPath(url);

  if (!isPublic) {
    // Read directly from the store singleton so we don't need React context
    // inside the interceptor (which runs outside of React's render cycle).
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const url = error.config?.url ?? '';
      // Don't redirect on auth endpoint 401s — the login page handles those.
      if (!isPublicPath(url)) {
        useAuthStore.getState().clearAuth();
        // Hard redirect so React state is fully reset.
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);
