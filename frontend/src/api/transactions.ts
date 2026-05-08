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
 * On 503 the account-service was unreachable on a fresh request. The backend
 * MAY have stored a FAILED row (consuming the key) or rolled back (key still
 * fresh) depending on where in the flow the failure landed — there is no
 * client-side way to disambiguate. The dialog's "close and reopen" UX mints a
 * new key for the next attempt; this is conservatively safe against returning
 * a stored FAILED row but does NOT eliminate the residual double-post risk if
 * the upstream account-service partially applied the balance before failing.
 * That residual risk is the same as the existing createTransaction flow and
 * is the rationale for the transactional-outbox note in the backend service.
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
