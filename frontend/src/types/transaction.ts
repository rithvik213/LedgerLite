export type TransactionStatus = 'PENDING' | 'POSTED' | 'FAILED';

export interface CreateTransactionRequest {
  accountId: string;
  /** Decimal string — never use number for money */
  amount: string;
  category?: string;
  description?: string;
}

/** Mirror of TransactionResponse record from transaction-service */
export interface TransactionResponse {
  id: string;
  accountId: string;
  userId: string;
  /** Decimal string */
  amount: string;
  category: string | null;
  description: string | null;
  idempotencyKey: string;
  status: TransactionStatus;
  failureReason: string | null;
  /** ISO-8601 instant string */
  createdAt: string;
}
