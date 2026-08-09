import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, Button, Alert, Spinner } from '@aura/ui';
import { api } from '../lib/api';
import { AppShell } from '../components/AppShell';

export function DashboardPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    user?: { fullName?: string };
    stats?: { projectCount?: number; videoCount?: number; creditBalance?: number };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const overview = await api.getDashboard();
        if (!cancelled) setData(overview as typeof data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t('errors.GENERIC'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <AppShell title={t('dashboard.title')}>
      {loading && <Spinner />}
      {error && <Alert variant="error">{error}</Alert>}
      {data && (
        <div className="space-y-6">
          <p className="text-lg">{t('dashboard.welcome', { name: data.user?.fullName || '' })}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>{t('dashboard.projectsCount')}</CardTitle></CardHeader>
              <CardContent className="text-3xl font-semibold">{data.stats?.projectCount ?? 0}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t('dashboard.videosCount')}</CardTitle></CardHeader>
              <CardContent className="text-3xl font-semibold">{data.stats?.videoCount ?? 0}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{t('dashboard.creditsBalance')}</CardTitle></CardHeader>
              <CardContent className="text-3xl font-semibold">{data.stats?.creditBalance ?? 0}</CardContent>
            </Card>
          </div>
          <div>
            <h2 className="mb-2 font-medium">{t('dashboard.quickActions')}</h2>
            <div className="flex flex-wrap gap-2">
              <Link to="/ai"><Button>{t('nav.aiStudio')}</Button></Link>
              <Link to="/video"><Button variant="secondary">{t('nav.video')}</Button></Link>
              <Link to="/templates"><Button variant="outline">{t('nav.templates')}</Button></Link>
              <Link to="/library"><Button variant="outline">{t('nav.library')}</Button></Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
