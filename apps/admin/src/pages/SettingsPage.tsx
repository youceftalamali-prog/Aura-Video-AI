import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, Spinner } from '@aura/ui';
import { adminApi } from '../lib/api';
import { ProvidersTab } from './settings/ProvidersTab';
import { ModelsTab } from './settings/ModelsTab';
import { RoutingTab } from './settings/RoutingTab';
import { FeatureFlagsTab } from './settings/FeatureFlagsTab';
import { HealthTab } from './settings/HealthTab';

interface Setting {
  key: string;
  value: unknown;
  description: string | null;
}

const TABS = [
  { id: 'providers', label: 'AI Providers' },
  { id: 'models', label: 'Models' },
  { id: 'routing', label: 'Routing' },
  { id: 'flags', label: 'Feature Flags' },
  { id: 'health', label: 'System Health' },
  { id: 'settings', label: 'Key-Value Store' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function SettingsPage() {
  const [tab, setTab] = useState<TabId>('providers');
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.listSettings() as Promise<Setting[]>,
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Developer Settings</h1>
      <p className="mb-6 text-sm text-slate-500">Manage AI providers, models, routing and platform flags.</p>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'providers' ? <ProvidersTab /> : null}
      {tab === 'models' ? <ModelsTab /> : null}
      {tab === 'routing' ? <RoutingTab /> : null}
      {tab === 'flags' ? <FeatureFlagsTab /> : null}
      {tab === 'health' ? <HealthTab /> : null}
      {tab === 'settings' ? (
        <Card>
          <CardHeader>
            <CardTitle>Application settings (key-value store)</CardTitle>
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
      ) : null}
    </div>
  );
}