import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Spinner, Badge } from '@aura/ui';
import type { LibraryTemplateCategory } from '@aura/types';
import { api } from '../lib/api';

export function TemplatesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<LibraryTemplateCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listTemplateCategories()
      .then(setCategories)
      .catch((e) => setError(e instanceof Error ? e.message : t('common.failedToLoad')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/dashboard" className="text-lg font-bold text-indigo-600">Aura Video AI</Link>
          <Link to="/dashboard" className="text-sm text-slate-600">{t('nav.dashboard')}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('templates.readyMade')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('templates.chooseCategory')}</p>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        {loading && <div className="flex justify-center py-16"><Spinner /></div>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => (
            <Link key={c.slug} to={`/templates/${c.slug}`} className="group">
              <div className={`aspect-[9/16] rounded-2xl bg-gradient-to-br ${c.previewGradient} p-4 shadow-md transition group-hover:scale-[1.02] group-hover:shadow-lg`}>
                <div className="flex h-full flex-col justify-end text-white">
                  <p className="text-lg font-semibold drop-shadow">{c.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-white/80">{c.description}</p>
                  <Badge variant="default" className="mt-2 w-fit bg-white/20 text-white">{c.templateCount} templates</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
