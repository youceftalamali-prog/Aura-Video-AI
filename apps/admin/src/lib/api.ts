const ACCESS_TOKEN_KEY = 'aura_admin_access_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error?.message || 'Request failed');
  }
  return data.data as T;
}

export const adminApi = {
  login: (email: string, password: string) =>
    request<{ tokens: { accessToken: string }; user: { role: string } }>('POST', '/api/v1/auth/login', {
      email,
      password,
    }),
  listUsers: () => request<unknown[]>('GET', '/api/v1/admin/users'),
  listPlans: () => request<unknown[]>('GET', '/api/v1/admin/plans'),
  listSettings: () => request<unknown[]>('GET', '/api/v1/admin/settings'),
};
