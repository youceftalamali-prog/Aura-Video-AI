import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input, Spinner, Badge } from '@aura/ui';
import { adminApi, type AdminSafeProviderConfig } from '../../lib/api';

const CONFIGURABLE_PROVIDERS = ['openai', 'openrouter'];

interface FormState {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  defaultModelId: string;
}

const emptyForm: FormState = {
  providerId: 'openai',
  baseUrl: '',
  apiKey: '',
  enabled: true,
  defaultModelId: '',
};

export function ProvidersTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<AdminSafeProviderConfig | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string | null>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ai-providers'],
    queryFn: () => adminApi.listAiProviders(),
  });

  const create = useMutation({
    mutationFn: () =>
      adminApi.createAiProvider({
        providerId: form.providerId,
        baseUrl: form.baseUrl.trim() || undefined,
        apiKey: form.apiKey.trim() || undefined,
        enabled: form.enabled,
        defaultModelId: form.defaultModelId.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ai-providers'] });
      setMessage(`Provider "${form.providerId}" saved.`);
      setForm(emptyForm);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save provider');
      setMessage(null);
    },
  });

  const update = useMutation({
    mutationFn: (config: AdminSafeProviderConfig) =>
      adminApi.updateAiProvider(config.id, {
        baseUrl: form.baseUrl.trim() || undefined,
        apiKey: form.apiKey.trim() || undefined,
        enabled: form.enabled,
        defaultModelId: form.defaultModelId.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ai-providers'] });
      setMessage('Provider updated.');
      setEditing(null);
      setForm(emptyForm);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to update provider');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteAiProvider(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ai-providers'] });
      setMessage('Provider configuration deleted.');
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to delete provider');
    },
  });

  async function test(id: string) {
    setTestResult((prev) => ({ ...prev, [id]: 'testing…' }));
    try {
      const result = await adminApi.testAiProvider(id);
      setTestResult((prev) => ({
        ...prev,
        [id]: result.ok ? `OK (${result.latencyMs ?? '?'}ms)` : `Failed: ${result.error ?? result.message}`,
      }));
    } catch (err) {
      setTestResult((prev) => ({
        ...prev,
        [id]: err instanceof Error ? `Error: ${err.message}` : 'Test failed',
      }));
    }
  }

  function startEdit(config: AdminSafeProviderConfig) {
    setEditing(config);
    setForm({
      providerId: config.providerId,
      baseUrl: config.baseUrl ?? '',
      apiKey: '',
      enabled: config.enabled,
      defaultModelId: config.defaultModelId ?? '',
    });
    setMessage(null);
    setError(null);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">AI providers</h2>
        <Badge>{CONFIGURABLE_PROVIDERS.length} configurable</Badge>
      </div>

      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="space-y-4">
        {data?.providers.map((provider) => (
          <div key={provider.providerId} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-medium text-slate-900">{provider.providerId}</p>
              <Badge variant={provider.availability === 'enabled' ? 'success' : 'warning'}>
                {provider.availability}
              </Badge>
              {provider.models ? (
                <span className="text-xs text-slate-500">
                  {provider.models.count} catalog models
                  {provider.models.refreshedAt ? ` · refreshed ${new Date(provider.models.refreshedAt).toLocaleString()}` : ''}
                </span>
              ) : null}
            </div>

            {provider.configs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No configuration yet. Create one to connect {provider.providerId}.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {provider.configs.map((config) => (
                  <div key={config.id} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={config.enabled ? 'success' : 'danger'}>
                        {config.enabled ? 'enabled' : 'disabled'}
                      </Badge>
                      <span className="text-slate-600">
                        {config.workspaceId ? `workspace: ${config.workspaceId}` : 'system scope'}
                      </span>
                      {config.baseUrl ? (
                        <span className="max-w-xs truncate text-slate-500" title={config.baseUrl}>
                          {config.baseUrl}
                        </span>
                      ) : null}
                      <span className="text-slate-500">
                        API key:{' '}
                        {config.hasKey ? (
                          <span className="font-medium text-slate-700">{config.maskedHint ?? 'configured'}</span>
                        ) : (
                          <span className="text-amber-600">not set</span>
                        )}
                      </span>
                      <span className="ml-auto flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => test(config.id)}>
                          Test
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEdit(config)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => {
                            if (window.confirm('Delete this provider configuration?')) remove.mutate(config.id);
                          }}
                        >
                          Delete
                        </Button>
                      </span>
                    </div>
                    {testResult[config.id] ? (
                      <p className="mt-2 text-xs text-slate-600">Test: {testResult[config.id]}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        <h3 className="mb-3 font-medium text-slate-900">{editing ? `Edit ${editing.providerId}` : 'Add provider configuration'}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm text-slate-600">
            Provider
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={form.providerId}
              disabled={Boolean(editing)}
              onChange={(e) => setForm({ ...form, providerId: e.target.value })}
            >
              {CONFIGURABLE_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-600">
            Base URL (optional)
            <Input
              className="mt-1"
              value={form.baseUrl}
              placeholder="https://api.openai.com/v1"
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </label>
          <label className="block text-sm text-slate-600">
            API key (write-only)
            <Input
              className="mt-1"
              type="password"
              value={form.apiKey}
              placeholder={editing ? (editing.hasKey ? `leave blank to keep current (${editing.maskedHint ?? 'configured'})` : 'enter API key') : 'sk-…'}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
            {editing ? (
              <span className="text-xs text-slate-400">
                Stored keys are never returned by the API. {editing.hasKey ? `Current key: ${editing.maskedHint}` : 'No key stored yet.'}
              </span>
            ) : null}
          </label>
          <label className="block text-sm text-slate-600">
            Default model (optional)
            <Input
              className="mt-1"
              value={form.defaultModelId}
              placeholder="gpt-4o-mini"
              onChange={(e) => setForm({ ...form, defaultModelId: e.target.value })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-600"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Enabled
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => (editing ? update.mutate(editing) : create.mutate())}>
            {editing ? 'Save changes' : 'Create provider'}
          </Button>
          {editing ? (
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}