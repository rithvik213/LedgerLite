import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAccount, getAccount, listAccounts } from '../api/accounts';
import type { CreateAccountRequest } from '../types/account';

export const ACCOUNTS_QUERY_KEY = ['accounts'] as const;

export function useAccountsList() {
  return useQuery({
    queryKey: ACCOUNTS_QUERY_KEY,
    queryFn: listAccounts,
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: [...ACCOUNTS_QUERY_KEY, id],
    queryFn: () => getAccount(id),
    // Disable automatic retry on 404 — the App.tsx QueryClient already handles
    // 4xx suppression, but being explicit here makes the intent obvious.
    enabled: Boolean(id),
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAccountRequest) => createAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
    },
  });
}
