import axios, { AxiosError } from 'axios';

/**
 * Resolves the centralized API base URL.
 * Supports VITE_API_URL and VITE_API_BASE_URL, trims trailing slashes,
 * and ensures the correct /api/v1 prefix without duplicates.
 */
function resolveApiBaseUrl(): string {
  const envUrl = (
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD ? '/api/v1' : 'http://localhost:5000/api/v1')
  ).trim();

  const cleanUrl = envUrl.replace(/\/+$/, '');

  if (cleanUrl.endsWith('/api/v1')) {
    return cleanUrl;
  }
  if (cleanUrl.endsWith('/api')) {
    return `${cleanUrl}/v1`;
  }
  return `${cleanUrl}/api/v1`;
}

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// In-memory token storage (never stored in localStorage, strictly in JS execution memory)
let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

// Request interceptor to attach Bearer token when available in memory
apiClient.interceptors.request.use((config) => {
  if (inMemoryToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  return config;
});

// Response interceptor for unified error formatting & session expiry handling
apiClient.interceptors.response.use(
  response => response,
  (error: AxiosError<any>) => {
    const errorData = error.response?.data;
    const message = errorData?.message || error.message || 'An unexpected error occurred';

    // Enrich error message
    error.message = message;

    // Handle session expiry gracefully without hard browser reload loops
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login' &&
      !error.config?.url?.includes('/auth/me') &&
      !error.config?.url?.includes('/auth/login')
    ) {
      setAuthToken(null);
      window.dispatchEvent(new CustomEvent('sifon:unauthorized'));
    }

    return Promise.reject(error);
  }
);
