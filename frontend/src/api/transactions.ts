import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';
import type { CreateTransactionRequest, TransactionResponse } from '../types/transaction';

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
