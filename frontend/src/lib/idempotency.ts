/**
 * Generates a new idempotency key using the Web Crypto API.
 * Each POST /api/transactions call must include a unique key in the
 * `Idempotency-Key` header. The transaction-service dedupes on this value,
 * so callers that retry on network error must reuse the same key they
 * generated for the first attempt.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
