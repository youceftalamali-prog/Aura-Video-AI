import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, CardHeader, CardTitle, CardContent, Alert, Spinner, Badge, Input } from '@aura/ui';
import type { LibraryTemplate, ProductRecord, TemplatePreviewConfig, BrandKit } from '@aura/types';
import { api } from '../lib/api';

export function TemplateDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState<LibraryTemplate | null>(null);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [productId, setProductId] = useState('');
  const [headline, setHeadline] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [cta, setCta] = useState('');
  const [brandName, setBrandName] = useState('');
  const [applyBrandKit, setApplyBrandKit] = useState(true);
  const [preview, setPreview] = useState<TemplatePreviewConfig | null>(null);
  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getTemplate(id),
      api.listProducts(),
      api.getBrandKit().catch(() => null),
    ])
      .then(([t, p, b]) => {
        setTpl(t);
        setProducts(p);
        if (p[0]) setProductId(p[0].id);
        if (b) {
          setBrand(b);
          setBrandName(b.brandName || '');
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failedToLoad')))
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-fill from product intelligence when product changes
  useEffect(() => {
    if (!productId) return;
    api.getProductIntelligence(productId)
      .then((intel) => {
        setHeadline((h) => h || intel.analysis.sellingPoints?.[0] || intel.analysis.productName || '');
        setSubheadline((s) => s || intel.analysis.shortDescription || '');
        setCta((c) => c || intel.analysis.callToAction || t('templates.shopNow'));
      })
      .catch(() => undefined);
  }, [productId]);

  async function runPreview() {
    if (!tpl || !productId) return;
    setBusy(true);
    setError(null);
    try {
      const cfg = await api.previewTemplate(tpl.slug, {
        productId,
        brandKitApplied: applyBrandKit,
        textOverrides: { headline, subheadline, cta, brandName },
      });
      setPreview(cfg);
      setShowCustomize(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('templates.previewFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!tpl || !productId) {
      setError(t('templates.selectProductFirst'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.generateFromTemplateCustom(tpl.slug, {
        productId,
        brandKitApplied: applyBrandKit,
        textOverrides: { headline, subheadline, cta, brandName },
      });
      sessionStorage.setItem(
        'aura:lastVideoFlow',
        JSON.stringify({
          templateId: result.templateId,
          productId: result.productId,
          storyboard: result.storyboard,
          strategy: result.strategy,
          script: result.script,
          generationConfig: result.generationConfig,
          preview: result.preview,
        }),
      );
      navigate('/video');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('templates.generationFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
  if (!tpl) return <div className="p-8"><Alert variant="error">{error || 'Template not found'}</Alert></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to={`/templates/${tpl.category}`} className="text-sm text-indigo-600">← {tpl.category}</Link>
          <Link to="/dashboard" className="text-lg font-bold text-indigo-600">Aura Video AI</Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-[9/16] overflow-hidden rounded-2xl bg-slate-900">
            {tpl.hasRealPreview && tpl.previewVideoUrl ? (
              <video src={tpl.previewVideoUrl} controls muted playsInline className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="text-lg font-medium text-slate-200">{tpl.name}</p>
                <Badge variant="default">{t('templates.previewUnavailable')}</Badge>
                <p className="text-xs text-slate-500">{t('templates.noRealPreview')}</p>
              </div>
            )}
          </div>
          {tpl.thumbnailUrl && (
            <img src={tpl.thumbnailUrl} alt="" className="h-20 rounded-lg object-cover" />
          )}
        </div>

        <div className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{tpl.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="info">{tpl.aspectRatio}</Badge>
              <Badge variant="default">{tpl.durationSeconds}s</Badge>
              <Badge variant="default">{tpl.category}</Badge>
              {tpl.subCategory && <Badge variant="default">{tpl.subCategory}</Badge>}
              {tpl.tags.map((tag) => (
                <Badge key={tag} variant="default">{tag}</Badge>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-600">{tpl.description}</p>
          </div>

          <Card>
            <CardHeader><CardTitle>{t('templates.scenes')}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {tpl.scenes.map((s) => (
                <div key={s.order} className="rounded border border-slate-100 p-2">
                  <span className="font-medium">#{s.order} {s.title}</span>
                  <span className="text-slate-500"> · {s.durationSeconds}s · {s.type}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('common.product')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {products.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t('products.empty')} <Link className="text-indigo-600" to="/products/import">Import a product</Link>
                </p>
              ) : (
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('templates.customize')}</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowCustomize((v) => !v)}>
                  {showCustomize ? t('common.hide') : t('templates.customize')}
                </Button>
              </div>
            </CardHeader>
            {showCustomize && (
              <CardContent className="space-y-3">
                <Input label={t('common.headline')} value={headline} onChange={(e) => setHeadline(e.target.value)} />
                <Input label={t('common.subheadline')} value={subheadline} onChange={(e) => setSubheadline(e.target.value)} />
                <Input label="CTA" value={cta} onChange={(e) => setCta(e.target.value)} />
                <Input label={t('common.brandName')} value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={applyBrandKit} onChange={(e) => setApplyBrandKit(e.target.checked)} />
                  Apply Brand Kit{brand ? ` (${brand.brandName})` : ''}
                </label>
                <Button size="sm" variant="secondary" loading={busy} onClick={runPreview}>
                  Preview configuration
                </Button>
              </CardContent>
            )}
          </Card>

          {preview && (
            <Card>
              <CardHeader><CardTitle>{t('templates.configPreview')}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>{t('ai.productLabel')}:</strong> {preview.productName}</p>
                <p><strong>{t('creative.durationColon')}</strong> {preview.duration}s · {preview.aspectRatio}</p>
                <p><strong>{t('templates.headlineColon')}</strong> {preview.textOverrides.headline}</p>
                <p><strong>{t('video.ctaColon')}</strong> {preview.textOverrides.cta}</p>
                {preview.scenes.map((s) => (
                  <div key={s.order} className="rounded border border-slate-100 p-2 text-xs">
                    #{s.order} {s.title}: {s.onScreenText || '—'}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button loading={busy} disabled={!productId} onClick={generate}>
              Generate Video
            </Button>
            <Button variant="outline" loading={busy} disabled={!productId} onClick={runPreview}>
              Use Template
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Browsing and customizing are free. Credits apply only when the existing video/AI pipeline runs.
          </p>
        </div>
      </main>
    </div>
  );
}
