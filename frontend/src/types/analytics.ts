/** Mirror of SpendingResponse record from analytics-service */
export interface SpendingResponse {
  userId: string;
  accountId: string;
  /** "YYYY-MM" */
  yearMonth: string;
  category: string;
  /** Decimal string */
  totalAmount: string;
  transactionCount: number;
}

export interface SpendingQueryParams {
  accountId: string;
  /** "YYYY-MM" */
  month: string;
}

export interface SpendingByCategoryParams {
  /** "YYYY-MM" */
  month: string;
}
