import { apiClient } from './client';
import type {
  SpendingByCategoryParams,
  SpendingQueryParams,
  SpendingResponse,
} from '../types/analytics';

export async function getSpending(params: SpendingQueryParams): Promise<SpendingResponse[]> {
  const res = await apiClient.get<SpendingResponse[]>('/api/analytics/spending', { params });
  return res.data;
}

export async function getSpendingByCategory(
  params: SpendingByCategoryParams,
): Promise<SpendingResponse[]> {
  const res = await apiClient.get<SpendingResponse[]>('/api/analytics/spending/by-category', {
    params,
  });
  return res.data;
}
