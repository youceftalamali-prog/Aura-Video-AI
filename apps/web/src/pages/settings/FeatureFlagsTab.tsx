import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Spinner, Badge } from '@aura/ui';
import { adminApi, type AdminFeatureFlag } from '../../lib/adminApi';

export function FeatureFlagsTab() {
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: () => adminApi.listFeatureFlags(),
  });

  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      adminApi.updateFeatureFlag(key, { enabled, description: undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-feature-flags'] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to update flag');
    },
  });

  const add = useMutation({
    mutationFn: (key: string) => adminApi.updateFeatureFlag(key, { enabled: false, description: 'Created from admin UI' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      setNewKey('');
      setMessage(`Flag "${newKey}" created.`);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to create flag');
      setMessage(null);
    },
  });

  const remove = useMutation({
    mutationFn: (key: string) => adminApi.deleteFeatureFlag(key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      setMessage('Flag deleted.');
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to delete flag');
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Feature flags</h2>
      <p className="text-sm text-slate-500">
        Toggle features across the platform. Flags are stored as <code>flags.*</code> keys in the settings store and are
        consulted by the backend before enabling experimental behavior.
      </p>

      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-64"
          placeholder="flags.my_feature"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <Button
          onClick={() => {
            if (newKey.trim().startsWith('flags.')) add.mutate(newKey.trim());
            else setError('Key must start with "flags."');
          }}
          disabled={add.isPending}
        >
          Add flag
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{data?.length ?? 0} flags</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data ?? []).length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No feature flags configured.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Key</th>
                    <th className="px-4 py-2">State</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data ?? []).map((flag: AdminFeatureFlag) => (
                    <tr key={flag.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs text-slate-800">{flag.key}</td>
                      <td className="px-4 py-2">
                        <Badge variant={flag.enabled ? 'success' : 'default'}>{flag.enabled ? 'enabled' : 'disabled'}</Badge>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{flag.description ?? '—'}</td>
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => toggle.mutate({ key: flag.key, enabled: !flag.enabled })}>
                          {flag.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2 text-red-600"
                          onClick={() => {
                            if (window.confirm(`Delete flag "${flag.key}"?`)) remove.mutate(flag.key);
                          }}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}