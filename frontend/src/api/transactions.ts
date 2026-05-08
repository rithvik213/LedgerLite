import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';
import type {
  CreateTransactionRequest,
  ReverseTransactionRequest,
  TransactionResponse,
} from '../types/transaction';

/**
 * Creates a transaction.
 *
 * RETRY SAFETY: callers that may retry on network failure MUST generate the
 * key once with `newIdempotencyKey()`, store it, and pass it explicitly on
 * every retry — otherwise each retry sends a fresh UUID and the backend
 * treats them as distinct transactions, defeating the deduplication and
 * potentially producing duplicate financial entries. The default-arg form
 * is only safe for first-attempt-only flows (e.g. a form submit guarded by
 * a disabled button).
 */
export async function createTransaction(
  data: CreateTransactionRequest,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<TransactionResponse> {
  const res = await apiClient.post<TransactionResponse>('/api/transactions', data, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return res.data;
}

export async function getTransaction(id: string): Promise<TransactionResponse> {
  const res = await apiClient.get<TransactionResponse>(`/api/transactions/${id}`);
  return res.data;
}

export async function listTransactions(accountId: string): Promise<TransactionResponse[]> {
  const res = await apiClient.get<TransactionResponse[]>('/api/transactions', {
    params: { accountId },
  });
  return res.data;
}

/**
 * Posts a reversal for an existing transaction.
 *
 * The backend is append-only: the original row is never mutated. A reversal
 * creates a new row with negated amount and a non-null `reversesTransactionId`.
 *
 * RETRY SAFETY: same as createTransaction. Generate one key per intent, reuse
 * it across retries. On 200 (idempotent replay) the backend returns the
 * previously-created reversal — treat it as success.
 *
 * On 503 the account-service was unreachable during this fresh request. The
 * caller must NOT retry with the same idempotency key — the backend hasn't
 * stored the row so the key has not been "used". Generate a new key on retry
 * (which the dialog achieves by closing and reopening, minting a fresh key in
 * the useEffect).
 */
export async function reverseTransaction(
  id: string,
  body: ReverseTransactionRequest,
  idempotencyKey: string,
): Promise<{ data: TransactionResponse; alreadyApplied: boolean }> {
  const res = await apiClient.post<TransactionResponse>(
    `/api/transactions/${id}/reverse`,
    body,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
  // 200 = idempotent replay (same key, already stored), 201 = newly created.
  return { data: res.data, alreadyApplied: res.status === 200 };
}
