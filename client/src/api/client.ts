import axios, { AxiosError, AxiosInstance } from 'axios';
import type { ApiResponse } from '@hera/shared';

const API_BASE = '/api';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hera_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export class ApiRequestError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;

    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('hera_token');
      if (!window.location.pathname.startsWith('/')) {
        window.location.href = '/';
      }
    }

    const message =
      body?.message ||
      (error.code === 'ECONNABORTED'
        ? 'Request timed out. Please try again.'
        : 'Something went wrong. Please try again.');

    return Promise.reject(
      new ApiRequestError(message, body?.code || 'UNKNOWN_ERROR', status, body?.details)
    );
  }
);

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export default api;
