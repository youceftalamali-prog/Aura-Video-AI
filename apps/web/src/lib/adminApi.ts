const ACCESS_TOKEN_KEY = 'aura_access_token';

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
  updateSetting: (key: string, value: unknown, description?: string) =>
    request('PUT', `/api/v1/admin/settings/${encodeURIComponent(key)}`, { value, description }),
  listAiProviders: () => request<AdminAiProvidersPayload>('GET', '/api/v1/admin/ai-providers'),
  createAiProvider: (input: unknown) => request('POST', '/api/v1/admin/ai-providers', input),
  updateAiProvider: (id: string, patch: unknown) => request('PATCH', `/api/v1/admin/ai-providers/${id}`, patch),
  deleteAiProvider: (id: string) => request('DELETE', `/api/v1/admin/ai-providers/${id}`),
  testAiProvider: (id: string) => request<{ ok: boolean; latencyMs: number | null; message: string; error?: string }>(
    'POST',
    `/api/v1/admin/ai-providers/${id}/test`,
  ),
  listAiModels: () => request<AdminAiModel[]>('GET', '/api/v1/admin/ai/models'),
  refreshAiModels: () => request<{ count: number; models: AdminAiModel[] }>('POST', '/api/v1/admin/ai/models/refresh'),
  listFeatureFlags: () => request<AdminFeatureFlag[]>('GET', '/api/v1/admin/feature-flags'),
  updateFeatureFlag: (key: string, value: { enabled: boolean; description?: string }) =>
    request('PUT', `/api/v1/admin/feature-flags/${encodeURIComponent(key)}`, value),
  deleteFeatureFlag: (key: string) => request('DELETE', `/api/v1/admin/feature-flags/${encodeURIComponent(key)}`),
  systemHealth: () => request<AdminSystemHealth>('GET', '/api/v1/admin/system/health'),
};

export interface AdminSafeProviderConfig {
  id: string;
  workspaceId: string | null;
  providerId: string;
  enabled: boolean;
  baseUrl: string | null;
  defaultModelId: string | null;
  capabilities: string[];
  hasKey: boolean;
  maskedHint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAiProvidersPayload {
  providers: Array<{
    providerId: string;
    availability: string;
    configs: AdminSafeProviderConfig[];
    models: { count: number; refreshedAt: number | null } | null;
  }>;
  registry: {
    providers: Record<string, string>;
    models: {
      staticCount: number;
      catalogCount: number;
      loaded: boolean;
      fresh: boolean;
      refreshedAt: number | null;
      ttlMs: number;
      lastError: string | null;
    };
  };
}

export interface AdminAiModel {
  id: string;
  displayName: string;
  providerId: string;
  capabilities: string[];
  contextLength: number | null;
  supportsVision: boolean;
  pricing: { prompt: number | null; completion: number | null } | null;
  source?: string;
  isDefault?: boolean;
}

export interface AdminFeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
}

export interface AdminSystemHealth {
  providers: Record<string, string>;
  models: { loaded: boolean; catalogCount: number; seededCount: number; refreshedAt: number | null };
  featureFlagsCount: number;
  settingsCount: number;
  timestamp: string;
}
