export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT';

export interface CreateAccountRequest {
  name: string;
  type: AccountType;
  /** ISO 4217 currency code; defaults to "USD" on the backend */
  currency?: string;
}

/** Mirror of AccountResponse record from account-service.
 *  balance is a string — never coerce financial values to number. */
export interface AccountResponse {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  /** Decimal string, e.g. "1234.5000" */
  balance: string;
  currency: string;
  version: number;
  /** ISO-8601 instant string */
  createdAt: string;
  /** ISO-8601 instant string */
  updatedAt: string;
}

export interface BalanceUpdateRequest {
  delta: string;
  expectedVersion: number;
}
