import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, CardTitle, CardContent, Alert, Spinner, Badge, Input } from '@aura/ui';
import { api } from '../lib/api';

type Overview = Awaited<ReturnType<typeof api.getBillingOverview>> & {
  plans?: Array<{ key: string; name: string; includedCredits: number; priceConfigured: boolean; planId: string }>;
  creditPackages?: Array<{ key: string; credits: number; label: string; priceConfigured: boolean }>;
  publishableKey?: string | null;
};

export function BillingPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Overview | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [ov, ws] = await Promise.all([api.getBillingOverview(), api.getWorkspaceSettings()]);
      setData(ov as Overview);
      setWorkspaceName(ws.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('billing.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function saveWorkspace() {
    setBusy(true);
    setError(null);
    try {
      await api.updateWorkspaceSettings({ name: workspaceName });
      setInfo(t('common.workspaceUpdated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.updateFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function subscribe(plan: 'starter' | 'pro' | 'business') {
    setBusy(true);
    setError(null);
    try {
      setInfo(t('billing.creating'));
      const { checkoutUrl } = await api.createSubscriptionCheckout(plan);
      setInfo(t('billing.redirecting'));
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('billing.checkoutFailed'));
      setBusy(false);
    }
  }

  async function buyCredits(pkg: 'small' | 'medium' | 'large') {
    setBusy(true);
    setError(null);
    try {
      const { checkoutUrl } = await api.createCreditCheckout(pkg);
      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('billing.checkoutFailed'));
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.createBillingPortalSession();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('billing.portalUnavailable'));
      setBusy(false);
    }
  }

  async function cancelSub() {
    setBusy(true);
    setError(null);
    try {
      if (!window.confirm(t('billing.cancelConfirm'))) return;
      await api.cancelSubscription();
      setInfo(t('billing.subscriptionCancelled'));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('billing.cancelFailed'));
    } finally {
      setBusy(false);
    }
  }

  const currentPlanId = data?.subscription?.planId;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-lg font-bold text-indigo-600">Aura Video AI</Link>
            <Badge variant="info">{t('billing.title')}</Badge>
          </div>
          <Link to="/library" className="text-sm text-slate-600">{t('library.title')}</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">{t('billing.creditsAndSubs')}</h1>
        {error && <Alert variant="error">{error}</Alert>}
        {info && <Alert variant="success">{info}</Alert>}
        {loading && <div className="flex justify-center py-12"><Spinner /></div>}

        {!loading && data && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500">{t('common.balance')}</p>
                  <p className="text-3xl font-semibold text-slate-900">{data.wallet.balance}</p>
                  <p className="text-xs text-slate-400">{t('billing.creditsLower')}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500">{t('billing.lifetimeGranted')}</p>
                  <p className="text-3xl font-semibold">{data.wallet.lifetimeGranted}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-slate-500">{t('billing.lifetimeUsed')}</p>
                  <p className="text-3xl font-semibold">{data.wallet.lifetimeUsed}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('billing.currentSubscription')}</CardTitle>
                  {data.subscription && (
                    <Button size="sm" variant="outline" loading={busy} onClick={openPortal}>{t('billing.manage')}</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {data.subscription ? (
                  <>
                    <Badge variant={data.subscription.status === 'active' ? 'success' : 'default'}>
                      {data.subscription.status}
                    </Badge>
                    <p>{t('billing.planIdColon')} <span className="font-mono text-xs">{data.subscription.planId}</span></p>
                    <p>Period: {new Date(data.subscription.currentPeriodStart).toLocaleDateString()} – {new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}</p>
                    {data.subscription.cancelAtPeriodEnd && <p className="text-amber-600">{t('billing.cancelsAtPeriodEnd')}</p>}
                    {!data.subscription.cancelAtPeriodEnd && (
                      <Button size="sm" variant="outline" loading={busy} onClick={cancelSub}>{t('billing.cancelSubscription')}</Button>
                    )}
                  </>
                ) : (
                  <p className="text-slate-500">{t('billing.noActiveSubscription')}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('billing.plans')}</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {(data.plans || [
                  { key: 'starter', name: 'Starter', includedCredits: 200, priceConfigured: false, planId: '' },
                  { key: 'pro', name: 'Pro', includedCredits: 1000, priceConfigured: false, planId: '' },
                  { key: 'business', name: 'Business', includedCredits: 5000, priceConfigured: false, planId: '' },
                ]).map((p) => (
                  <div key={p.key} className="rounded-lg border border-slate-200 p-4 space-y-2">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-slate-500">{p.includedCredits} credits / period</p>
                    {currentPlanId === p.planId && <Badge variant="success">{t('common.current')}</Badge>}
                    <Button
                      size="sm"
                      loading={busy}
                      disabled={!p.priceConfigured}
                      onClick={() => subscribe(p.key as 'starter' | 'pro' | 'business')}
                    >
                      {p.priceConfigured ? 'Subscribe' : t('common.priceNotConfigured')}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('billing.buyCredits')}</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {(data.creditPackages || [
                  { key: 'small', credits: 100, label: 'Small', priceConfigured: false },
                  { key: 'medium', credits: 500, label: 'Medium', priceConfigured: false },
                  { key: 'large', credits: 2000, label: 'Large', priceConfigured: false },
                ]).map((p) => (
                  <div key={p.key} className="rounded-lg border border-slate-200 p-4 space-y-2">
                    <p className="font-semibold">{p.label}</p>
                    <p className="text-sm text-slate-500">{p.credits} credits</p>
                    <Button
                      size="sm"
                      loading={busy}
                      disabled={!p.priceConfigured}
                      onClick={() => buyCredits(p.key as 'small' | 'medium' | 'large')}
                    >
                      {p.priceConfigured ? 'Buy' : t('common.priceNotConfigured')}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('billing.sampleCostEstimate')}</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>15s · 4 scenes · storyboard ≈ <strong>{data.estimateSample.credits}</strong> credits</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('billing.recentVideoCreditUsage')}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.recentUsage.length === 0 && <p className="text-slate-500">{t('billing.noVideoJobsYet')}</p>}
                {data.recentUsage.map((u) => (
                  <div key={u.jobId} className="flex flex-wrap justify-between gap-2 rounded border border-slate-100 p-2">
                    <span className="font-mono text-xs text-slate-500">{u.jobId.slice(0, 8)}…</span>
                    <Badge variant="default">{u.status}</Badge>
                    <span>{u.creditsCharged} cr</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('billing.workspaceSettings')}</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px] flex-1">
                  <Input label={t('common.workspaceName')} value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
                </div>
                <Button loading={busy} onClick={saveWorkspace}>{t('common.save')}</Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
