import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createTransaction,
  getTransaction,
  listTransactions,
  reverseTransaction,
} from '../api/transactions';
import type { CreateTransactionRequest, ReverseTransactionRequest } from '../types/transaction';
import { ACCOUNTS_QUERY_KEY } from './useAccounts';

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
      // The transaction has already updated the account's balance via
      // account-service. Invalidate the accounts cache so Dashboard's
      // total balance, AccountCard balances, and AccountDetail all refetch
      // — otherwise users see stale balances after posting a transaction.
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
    },
  });
}

export function useReverseTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      accountId,
      body,
      idempotencyKey,
    }: {
      transactionId: string;
      accountId: string;
      body: ReverseTransactionRequest;
      idempotencyKey: string;
    }) => reverseTransaction(transactionId, body, idempotencyKey).then((r) => ({ ...r, accountId })),
    onSuccess: ({ accountId }) => {
      // Reversal posts a new row AND adjusts the account balance — invalidate both.
      // list(accountId) already matches under the lists() prefix, no need to invalidate twice.
      queryClient.invalidateQueries({ queryKey: transactionKeys.list(accountId) });
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
    },
  });
}
