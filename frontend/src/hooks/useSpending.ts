import { useQuery } from '@tanstack/react-query';
import { getSpending, getSpendingByCategory } from '../api/analytics';
import type { SpendingResponse } from '../types/analytics';

/**
 * Fetches spending aggregated by category for a given month.
 * The by-category endpoint returns data across all accounts for the user.
 * Pass accountId to narrow to a specific account via getSpending instead.
 */
export function useSpendingByCategory(
  month: string,
  accountId?: string,
): {
  data: SpendingResponse[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  return useQuery({
    queryKey: ['spending', 'byCategory', month, accountId ?? 'all'],
    queryFn: () =>
      accountId
        ? getSpending({ accountId, month })
        : getSpendingByCategory({ month }),
    staleTime: 30_000,
    enabled: Boolean(month),
  });
}
