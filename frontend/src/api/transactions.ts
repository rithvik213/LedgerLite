import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';
import type { CreateTransactionRequest, TransactionResponse } from '../types/transaction';

/**
 * Creates a transaction. A new idempotency key is generated per call.
 *
 * If the caller needs retry semantics (i.e. reuse the same key on network
 * failure), it should generate the key with `newIdempotencyKey()`, store it,
 * and pass it as the second argument.
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
