import { apiClient } from './client';
import type { AccountResponse, BalanceUpdateRequest, CreateAccountRequest } from '../types/account';

export async function createAccount(data: CreateAccountRequest): Promise<AccountResponse> {
  const res = await apiClient.post<AccountResponse>('/api/accounts', data);
  return res.data;
}

export async function listAccounts(): Promise<AccountResponse[]> {
  const res = await apiClient.get<AccountResponse[]>('/api/accounts');
  return res.data;
}

export async function getAccount(id: string): Promise<AccountResponse> {
  const res = await apiClient.get<AccountResponse>(`/api/accounts/${id}`);
  return res.data;
}

export async function updateBalance(
  id: string,
  data: BalanceUpdateRequest,
): Promise<AccountResponse> {
  const res = await apiClient.patch<AccountResponse>(`/api/accounts/${id}/balance`, data);
  return res.data;
}
