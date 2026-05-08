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

    // Base64url → padded Base64 → UTF-8 string → JSON. Padding is required
    // because some browsers' atob throws on unpadded inputs whose length mod 4
    // is 1; UTF-8 decoding via TextDecoder handles non-ASCII payload fields
    // (e.g. emails with international characters) that plain atob mangles.
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    base64 += '='.repeat(padLen);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
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
