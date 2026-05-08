import type { JwtPayload } from '../types/auth';

/**
 * Decodes the payload of a JWT without verifying the signature.
 * Signature verification is the gateway's / backend services' responsibility.
 * We only decode to read the `exp` claim for client-side expiry checks.
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64url → Base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns true if the token is present and its `exp` claim is still in the
 * future (with a 30-second skew to account for clock drift + request latency).
 */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeJwt(token);
  if (!payload) return false;
  const skewMs = 30_000;
  return payload.exp * 1000 - skewMs > Date.now();
}
