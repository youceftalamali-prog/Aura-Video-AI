import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, Spinner } from '@aura/ui';
import { adminApi } from '../lib/api';

interface Setting {
  key: string;
  value: unknown;
  description: string | null;
}

export function SettingsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.listSettings() as Promise<Setting[]>,
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Application settings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {error && <p className="text-red-600">Failed to load settings</p>}
          {data && data.length === 0 && (
            <p className="py-6 text-center text-slate-500">No settings configured yet</p>
          )}
          {data && data.length > 0 && (
            <div className="space-y-4">
              {data.map((s) => (
                <div key={s.key} className="rounded-lg border border-slate-200 p-4">
                  <p className="font-medium text-slate-900">{s.key}</p>
                  {s.description && <p className="mt-0.5 text-sm text-slate-500">{s.description}</p>}
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                    {JSON.stringify(s.value, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
