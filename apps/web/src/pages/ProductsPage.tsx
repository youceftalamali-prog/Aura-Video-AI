import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, Alert, Spinner, Badge } from '@aura/ui';
import type { ProductRecord } from '@aura/types';
import { api } from '../lib/api';

export function ProductsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<ProductRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listProducts();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onDelete(id: string) {
    try {
      await api.deleteProduct(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.deleteFailed'));
    }
  }

  async function onCreateVideo(id: string) {
    try {
      const flow = await api.createVideoFromProduct(id, { duration: 15, aspectRatio: '9:16' });
      sessionStorage.setItem('aura:lastVideoFlow', JSON.stringify(flow));
      navigate('/video');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('products.createVideoFailedShort'));
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/dashboard" className="text-lg font-bold text-indigo-600">Aura Video AI</Link>
          <Link to="/products/import">
            <Button size="sm">{t('products.import')}</Button>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">{t('products.title')}</h1>
        {error && <Alert variant="error">{error}</Alert>}
        {loading && <div className="flex justify-center py-12"><Spinner /></div>}
        {!loading && items.length === 0 && (
          <Card><CardContent className="py-10 text-center text-slate-500">{t('products.empty')} <Link className="text-indigo-600" to="/products/import">{t('products.importOne')}</Link></CardContent></Card>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-3 pt-6">
                {p.imageUrl && <img src={p.imageUrl} alt="" className="h-32 w-full rounded-lg object-cover" />}
                <div>
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="line-clamp-2 text-sm text-slate-500">{p.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.externalSource && <Badge variant="default">{p.externalSource}</Badge>}
                  {p.price && <Badge variant="info">{p.price} {p.currency}</Badge>}
                </div>
                <p className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onCreateVideo(p.id)}>{t('products.createVideoShort')}</Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/products/import`)}>{t('common.analyze')}</Button>
                  <Button size="sm" variant="outline" onClick={() => onDelete(p.id)}>{t('common.delete')}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
