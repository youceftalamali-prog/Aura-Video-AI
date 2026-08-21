import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, Spinner, Badge } from '@aura/ui';
import { adminApi } from '../../lib/adminApi';

export function HealthTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-system-health'],
    queryFn: () => adminApi.systemHealth(),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">System health</h2>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error instanceof Error ? error.message : 'Failed to load health data'}
        </p>
      ) : data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>AI providers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(data.providers).map(([name, state]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{name}</span>
                    <Badge variant={state === 'enabled' ? 'success' : state === 'missing-key' ? 'warning' : 'danger'}>
                      {state}
                    </Badge>
                  </div>
                ))}
                {Object.keys(data.providers).length === 0 ? (
                  <p className="text-sm text-slate-500">No providers registered.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Model catalog</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd>
                    <Badge variant={data.models.loaded ? 'success' : 'danger'}>
                      {data.models.loaded ? 'loaded' : 'not loaded'}
                    </Badge>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Catalog models</dt>
                  <dd className="font-medium text-slate-800">{data.models.catalogCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Seeded (env) models</dt>
                  <dd className="font-medium text-slate-800">{data.models.seededCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Last refresh</dt>
                  <dd className="font-medium text-slate-800">
                    {data.models.refreshedAt ? new Date(data.models.refreshedAt).toLocaleString() : 'never'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings store</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Feature flags</dt>
                  <dd className="font-medium text-slate-800">{data.featureFlagsCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Total settings keys</dt>
                  <dd className="font-medium text-slate-800">{data.settingsCount}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                Health snapshot taken at{' '}
                <span className="font-medium text-slate-800">{new Date(data.timestamp).toLocaleString()}</span>. Public
                endpoint <code className="rounded bg-slate-100 px-1">/api/v1/health</code> reports service liveness.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}