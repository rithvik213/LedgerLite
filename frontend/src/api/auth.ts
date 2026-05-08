import { apiClient } from './client';
import type { AuthResponse, LoginRequest, RegisterRequest, UserResponse } from '../types/auth';

export async function register(data: RegisterRequest): Promise<UserResponse> {
  const res = await apiClient.post<UserResponse>('/api/auth/register', data);
  return res.data;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/api/auth/login', data);
  return res.data;
}

export async function getMe(): Promise<UserResponse> {
  const res = await apiClient.get<UserResponse>('/api/auth/me');
  return res.data;
}
