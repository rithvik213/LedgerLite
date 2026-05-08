import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTransaction,
  getTransaction,
  listTransactions,
} from '../api/transactions';
import type { CreateTransactionRequest } from '../types/transaction';

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (accountId: string) => [...transactionKeys.lists(), accountId] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
};

export function useTransactionsList(accountId?: string) {
  return useQuery({
    queryKey: transactionKeys.list(accountId ?? ''),
    queryFn: () => listTransactions(accountId ?? ''),
    // Only run when an account is selected — an empty accountId would 400
    enabled: Boolean(accountId),
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn: () => getTransaction(id),
    enabled: Boolean(id),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      data,
      idempotencyKey,
    }: {
      data: CreateTransactionRequest;
      idempotencyKey: string;
    }) => createTransaction(data, idempotencyKey),
    onSuccess: (result) => {
      // Invalidate the list for the relevant account so the table refreshes
      queryClient.invalidateQueries({
        queryKey: transactionKeys.list(result.accountId),
      });
      // Also invalidate "all lists" in case the page shows an aggregate view
      queryClient.invalidateQueries({
        queryKey: transactionKeys.lists(),
      });
    },
  });
}
