/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // During development, proxy all /api requests to the running gateway.
      // In production the frontend is served from the same origin as the gateway
      // (or VITE_API_BASE_URL is set to the gateway URL).
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Vitest's default `include` would pick up `e2e/*.spec.ts`; that suite
    // belongs to Playwright and runs against a real browser, not jsdom.
    exclude: ['node_modules', 'dist', 'e2e'],
  },
});
