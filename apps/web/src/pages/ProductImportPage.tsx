import { useTranslation } from 'react-i18next';
import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Alert, Spinner, Badge } from '@aura/ui';
import type { ProductImportResult, ProductIntelligence, GeneratedHook } from '@aura/types';
import { api } from '../lib/api';

type Tab = 'url' | 'image' | 'description';

export function ProductImportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('url');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const [hooks, setHooks] = useState<GeneratedHook[]>([]);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null);

  async function onImport(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    setHooks([]);
    try {
      let data: ProductImportResult;
      if (tab === 'url') {
        data = await api.importProductUrl(url);
      } else if (tab === 'image') {
        data = await api.importProductImage({ imageUrl, name: name || undefined, description: description || undefined });
      } else {
        data = await api.importProductText({ name, description });
      }
      setResult(data);
      const intel = data.intelligence;
      const rec = intel.marketingAngles.find((a) => a.recommended);
      setSelectedAngle(rec?.type ?? intel.marketingAngles[0]?.type ?? null);
      try {
        const h = await api.generateProductHooks(data.product.id);
        setHooks(h);
        if (h[0]) setSelectedHook(h[0].text);
      } catch {
        setHooks([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.importFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function createVideo() {
    if (!result) return;
    setError(null);
    setLoading(true);
    try {
      const flow = await api.createVideoFromProduct(result.product.id, {
        angleType: selectedAngle as never,
        hookText: selectedHook || undefined,
        duration: 15,
        aspectRatio: '9:16',
      });
      // Persist into studio state if project exists later; navigate to creative/video with product context
      sessionStorage.setItem(
        'aura:lastVideoFlow',
        JSON.stringify({
          productId: flow.productId,
          storyboard: flow.storyboard,
          strategy: flow.strategy,
          script: flow.script,
          analysis: flow.analysis,
        }),
      );
      navigate('/video');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.createVideoFailed'));
    } finally {
      setLoading(false);
    }
  }

  const intel: ProductIntelligence | null = result?.intelligence ?? null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-lg font-bold text-indigo-600">Aura Video AI</Link>
            <Badge variant="info">{t('products.productImport')}</Badge>
          </div>
          <div className="flex gap-4 text-sm">
            <Link to="/products" className="text-slate-600 hover:text-slate-900">{t('library.title')}</Link>
            <Link to="/video" className="text-slate-600 hover:text-slate-900">{t('common.video')}</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('products.import')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('products.importFlow')}</p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex gap-2">
          {(['url', 'image', 'description'] as Tab[]).map((mode) => (
            <Button key={mode} type="button" size="sm" variant={tab === mode ? 'primary' : 'outline'} onClick={() => setTab(mode)}>
              {mode === 'url' ? t('common.url') : mode === 'image' ? t('common.image') : t('common.description')}
            </Button>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={onImport} className="space-y-4">
              {tab === 'url' && (
                <Input label={t('common.productUrl')} type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://..." />
              )}
              {tab === 'image' && (
                <>
                  <Input label="Image URL" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} required />
                  <Input label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                </>
              )}
              {tab === 'description' && (
                <>
                  <Input label={t('common.productName')} value={name} onChange={(e) => setName(e.target.value)} required />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('common.description')}</label>
                    <textarea className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} required />
                  </div>
                </>
              )}
              <Button type="submit" loading={loading}>{t('ai.analyzeProduct')}</Button>
            </form>
          </CardContent>
        </Card>

        {loading && !result && (
          <div className="flex justify-center py-8"><Spinner /></div>
        )}

        {result && intel && (
          <>
            <Card>
              <CardHeader><CardTitle>{result.product.name}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {result.product.imageUrl && (
                  <img src={result.product.imageUrl} alt="" className="h-40 rounded-lg object-cover" />
                )}
                <p>{intel.analysis.shortDescription}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">{intel.productProfile.category}</Badge>
                  {result.product.price && <Badge variant="info">{result.product.price} {result.product.currency}</Badge>}
                  {result.extracted?.sourcePlatform && <Badge variant="default">{result.extracted.sourcePlatform}</Badge>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('products.factsVsMarketing')}</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{t('common.facts')}</p>
                  <ul className="mt-2 list-disc ps-5 text-slate-600">
                    {intel.productProfile.facts.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                  <p className="mt-3 font-medium">{t('common.features')}</p>
                  <ul className="mt-1 list-disc ps-5 text-slate-600">
                    {intel.productProfile.features.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-900">{t('products.marketingInferred')}</p>
                  <p className="mt-2 text-slate-600"><strong>{t('products.primaryBenefit')}</strong> {intel.marketingProfile.primaryBenefit}</p>
                  <p className="mt-2 font-medium">{t('common.audience')}</p>
                  <ul className="list-disc ps-5 text-slate-600">
                    {intel.audienceProfile.useCases.map((u) => <li key={u}>{u}</li>)}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{t('products.marketingAngles')}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {intel.marketingAngles.map((a) => (
                  <button key={a.type} type="button" onClick={() => setSelectedAngle(a.type)}
                    className={`w-full rounded-lg border p-3 text-start text-sm ${selectedAngle === a.type ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                    <span className="font-medium">{a.title}</span>
                    {a.recommended && <Badge variant="success" className="ms-2">{t('common.recommended')}</Badge>}
                    <p className="text-slate-500">{a.description}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {hooks.length > 0 && (
              <Card>
                <CardHeader><CardTitle>{t('common.hooks')}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {hooks.map((h) => (
                    <button key={h.text} type="button" onClick={() => setSelectedHook(h.text)}
                      className={`w-full rounded-lg border p-3 text-start text-sm ${selectedHook === h.text ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                      <Badge variant="default">{h.style}</Badge>
                      <p className="mt-1">{h.text}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button onClick={createVideo} loading={loading}>{t('products.createVideoShort')}</Button>
              <Button variant="outline" onClick={() => setResult(null)}>{t('ai.editAnalysis')}</Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
