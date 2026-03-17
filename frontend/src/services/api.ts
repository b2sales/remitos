import { msalInstance } from '@/auth/AuthProvider';
import { apiScope } from '@/config/auth';
import { API_BASE_URL } from '@/config/api';

async function getToken(): Promise<string> {
  const account = msalInstance.getActiveAccount();
  if (!account) throw new Error('No active account');

  const response = await msalInstance.acquireTokenSilent({
    scopes: [apiScope],
    account,
  });
  return response.accessToken;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),

  post: <T>(path: string, data: unknown) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  put: <T>(path: string, data: unknown) =>
    apiFetch<T>(path, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
