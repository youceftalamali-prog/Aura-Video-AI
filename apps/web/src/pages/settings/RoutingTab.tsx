import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Spinner } from '@aura/ui';
import { adminApi } from '../../lib/adminApi';

const ROUTING_OPTIONS = [
  {
    id: 'fast',
    title: 'Fast',
    description: 'Prefer the cheapest enable provider to minimize latency and cost. Ideal for high-volume drafts.',
  },
  {
    id: 'balanced',
    title: 'Balanced',
    description: 'Trade-off between speed and quality. The default strategy.',
  },
  {
    id: 'smart',
    title: 'Smart',
    description: 'Prefer the highest-quality available model (e.g. OpenAI default model). Best for final output.',
  },
] as const;

export function RoutingTab() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.listSettings() as Promise<Array<{ key: string; value: unknown; description: string | null }>>,
  });

  const current: string =
    (data?.find((s) => s.key === 'ai.strategy')?.value as string | undefined) ?? 'balanced';

  const save = useMutation({
    mutationFn: (strategy: string) => adminApi.updateSetting('ai.strategy', strategy, 'Default AI routing strategy'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
      setMessage('Default routing strategy saved.');
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save strategy');
      setMessage(null);
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Routing strategy</h2>
      <p className="text-sm text-slate-500">
        The system default used when neither the user nor their workspace has chosen a strategy. Routing is performed by
        the backend RoutingResolver — this page only sets the default.
      </p>

      {message ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {!data ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {ROUTING_OPTIONS.map((option) => (
            <Card
              key={option.id}
              className={current === option.id ? 'ring-2 ring-indigo-400' : ''}
            >
              <CardHeader>
                <CardTitle className="capitalize">{option.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-600">{option.description}</p>
                <Button
                  size="sm"
                  variant={current === option.id ? 'primary' : 'outline'}
                  disabled={current === option.id || save.isPending}
                  onClick={() => save.mutate(option.id)}
                >
                  {current === option.id ? 'Current default' : 'Set as default'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}