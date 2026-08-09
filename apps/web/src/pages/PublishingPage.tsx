import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Alert, Badge } from '@aura/ui';
import type {
  PublishingProviderInfo,
  SocialConnectionPublic,
  PublishingJobPublic,
  PublishingPlatform,
} from '@aura/types';
import { api } from '../lib/api';

export function PublishingPage() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<PublishingProviderInfo[]>([]);
  const [connections, setConnections] = useState<SocialConnectionPublic[]>([]);
  const [jobs, setJobs] = useState<PublishingJobPublic[]>([]);
  const [assetId, setAssetId] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');

  async function refresh() {
    setError(null);
    try {
      const [p, c, j] = await Promise.all([
        api.listPublishingProviders(),
        api.listSocialConnections(),
        api.listPublishingJobs(),
      ]);
      setProviders(p);
      setConnections(c);
      setJobs(j);
      if (c[0] && !connectionId) setConnectionId(c[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('publishing.loadFailed'));
    }
  }

  useEffect(() => { refresh(); }, []);

  async function connect(platform: PublishingPlatform) {
    setError(null);
    setLoading(true);
    try {
      const { authorizationUrl, state } = await api.connectSocialAccount(platform);
      sessionStorage.setItem(`oauth_state_${platform}`, state);
      window.location.href = authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('publishing.connectFailed'));
      setLoading(false);
    }
  }

  async function disconnect(id: string) {
    try {
      await api.disconnectSocialAccount(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('publishing.disconnectFailed'));
    }
  }

  async function validateAndPublish(schedule: boolean) {
    setError(null);
    setLoading(true);
    try {
      const validation = await api.validatePublishing({ assetId, connectionId });
      if (!validation.valid) {
        setError(validation.errors.map((e) => e.message).join('; '));
        return;
      }
      const tags = hashtags.split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean);
      const payload = {
        assetId,
        connectionId,
        caption,
        hashtags: tags,
        platformOptions: youtubeTitle ? { title: youtubeTitle, description: caption } : {},
        scheduledAt: schedule && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        idempotencyKey: `pub-${assetId}-${connectionId}-${Date.now()}`,
      };
      if (schedule) await api.scheduleVideo(payload);
      else await api.publishVideo(payload);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('publishing.publishFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-lg font-bold text-indigo-600">Aura Video AI</Link>
            <Badge variant="info">{t('publishing.title')}</Badge>
          </div>
          <div className="flex gap-4 text-sm">
            <Link to="/video" className="text-slate-600 hover:text-slate-900">{t('common.video')}</Link>
            <Link to="/products" className="text-slate-600 hover:text-slate-900">{t('products.title')}</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">{t('publishing.title')}</h1>
        {error && <Alert variant="error">{error}</Alert>}

        <Card>
          <CardHeader><CardTitle>{t('publishing.platforms')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {providers.map((p) => (
              <div key={p.platform} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                <div>
                  <span className="font-medium">{p.displayName}</span>
                  <Badge variant={p.configured ? 'success' : 'default'} className="ms-2">
                    {p.configured ? t('common.configured') : t('common.notConfigured')}
                  </Badge>
                </div>
                <Button size="sm" variant="outline" disabled={!p.configured || loading} onClick={() => connect(p.platform)}>
                  Connect
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('publishing.connectedAccounts')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {connections.length === 0 && <p className="text-slate-500">{t('publishing.noAccounts')}</p>}
            {connections.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded border border-slate-100 p-3">
                <div>
                  <p className="font-medium">{c.accountName}</p>
                  <p className="text-slate-500">{c.platform} · {c.status}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConnectionId(c.id)}>{t('common.open')}</Button>
                  <Button size="sm" variant="outline" onClick={() => disconnect(c.id)}>{t('common.disconnect')}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('publishing.publishCompleted')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Asset ID (completed video UUID)" value={assetId} onChange={(e) => setAssetId(e.target.value)} required />
            <Input label={t('common.connectionId')} value={connectionId} onChange={(e) => setConnectionId(e.target.value)} required />
            <Input label="YouTube title (optional)" value={youtubeTitle} onChange={(e) => setYoutubeTitle(e.target.value)} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('publishing.caption')}</label>
              <textarea className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
            <Input label="Hashtags (space or comma separated)" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
            <Input label="Schedule at (local datetime)" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            <div className="flex gap-2">
              <Button loading={loading} onClick={() => validateAndPublish(false)}>{t('publishing.publishNow')}</Button>
              <Button variant="secondary" loading={loading} onClick={() => validateAndPublish(true)}>{t('publishing.schedule')}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('publishing.jobs')}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {jobs.length === 0 && <p className="text-slate-500">{t('publishing.noJobs')}</p>}
            {jobs.map((j) => (
              <div key={j.id} className="rounded border border-slate-100 p-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={j.status === 'published' ? 'success' : j.status === 'failed' ? 'danger' : 'info'}>{j.status}</Badge>
                  <Badge variant="default">{j.platform}</Badge>
                </div>
                <p className="mt-1 text-slate-500">Asset: {j.assetId}</p>
                {j.errorMessage && <p className="text-red-600">{j.errorMessage}</p>}
                {j.externalPostUrl && (
                  <a href={j.externalPostUrl} target="_blank" rel="noreferrer" className="text-indigo-600">{t('publishing.viewPost')}</a>
                )}
                <div className="mt-2 flex gap-2">
                  {j.status === 'failed' && (
                    <Button size="sm" variant="outline" onClick={async () => { await api.retryPublishingJob(j.id); await refresh(); }}>{t('common.retry')}</Button>
                  )}
                  {['queued', 'scheduled'].includes(j.status) && (
                    <Button size="sm" variant="outline" onClick={async () => { await api.cancelPublishingJob(j.id); await refresh(); }}>{t('common.cancel')}</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
