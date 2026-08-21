import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, CardHeader, CardTitle, CardContent, Spinner, Badge } from '@aura/ui';
import { adminApi, type AdminAiModel } from '../../lib/adminApi';

function priceLabel(model: AdminAiModel): string {
  if (!model.pricing) return '—';
  const p = model.pricing.prompt;
  const c = model.pricing.completion;
  if (p === null && c === null) return '—';
  const pLabel = p === null ? '—' : `$${p}/1K in`;
  const cLabel = c === null ? '—' : `$${c}/1K out`;
  return `${pLabel}, ${cLabel}`;
}

export function ModelsTab() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ai-models'],
    queryFn: () => adminApi.listAiModels(),
  });

  const refresh = useMutation({
    mutationFn: () => adminApi.refreshAiModels(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['admin-ai-models'] });
      setMessage(`Catalog refreshed: ${result.count} models.`);
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Refresh failed');
      setMessage(null);
    },
  });

  const filtered = (data ?? []).filter(
    (m) =>
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      m.providerId.toLowerCase().includes(search.toLowerCase()) ||
      (m.displayName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Model catalog</h2>
        <div className="flex items-center gap-2">
          <input
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
            placeholder="Search models…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? 'Refreshing…' : 'Refresh catalog'}
          </Button>
        </div>
      </div>

      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{filtered.length} models</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-2">Model</th>
                  <th className="px-4 py-2">Provider</th>
                  <th className="px-4 py-2">Context</th>
                  <th className="px-4 py-2">Vision</th>
                  <th className="px-4 py-2">Capabilities</th>
                  <th className="px-4 py-2">Pricing</th>
                  <th className="px-4 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {m.displayName}
                      {m.isDefault ? (
                        <Badge variant="info" className="ml-2">
                          default
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{m.providerId}</td>
                    <td className="px-4 py-2 text-slate-600">{m.contextLength ? m.contextLength.toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{m.supportsVision ? '✓' : '—'}</td>
                    <td className="px-4 py-2 text-slate-600">
                      <span className="flex flex-wrap gap-1">
                        {m.capabilities.slice(0, 3).map((c) => (
                          <Badge key={c}>{c}</Badge>
                        ))}
                        {m.capabilities.length > 3 ? <Badge>+{m.capabilities.length - 3}</Badge> : null}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{priceLabel(m)}</td>
                    <td className="px-4 py-2 text-slate-400">{m.source ?? '—'}</td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      No models found. Refresh the catalog after configuring a provider.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}