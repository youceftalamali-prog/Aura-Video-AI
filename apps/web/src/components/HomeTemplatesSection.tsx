import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LibraryTemplateCategory, LibraryTemplate } from '@aura/types';
import { api } from '../lib/api';
import { TemplatePhoneCard } from './TemplatePhoneCard';

const MAX_CURATED_PER_CATEGORY = 4;

interface CategoryRow {
  category: LibraryTemplateCategory;
  templates: LibraryTemplate[];
}

function groupCurated(templates: LibraryTemplate[], categories: LibraryTemplateCategory[]): CategoryRow[] {
  return categories
    .map((category) => ({
      category,
      templates: templates
        .filter((tp) => tp.category === category.slug)
        .slice(0, MAX_CURATED_PER_CATEGORY),
    }))
    .filter((row) => row.templates.length > 0);
}

export function HomeTemplatesSection() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<LibraryTemplateCategory[]>([]);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.listTemplateCategories(), api.listTemplates({ featured: true })])
      .then(([cats, featured]) => {
        setCategories(cats);
        if (featured.length > 0) {
          setRows(groupCurated(featured, cats));
          return;
        }
        return api.listTemplates().then((all) => setRows(groupCurated(all, cats)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('templates.failedToLoad', { defaultValue: 'Failed to load templates.' })))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">{t('templates.readyMade')}</h2>
          <p className="mt-1 text-sm text-violet-300/70">{t('templates.chooseCategory')}</p>
        </div>
        <Link to="/templates" className="aura-btn-ghost">
          {t('templates.browseAll', { defaultValue: 'Browse all templates' })} →
        </Link>
      </div>

      {!loading && !error && categories.length > 0 && (
        <div className="-mx-1 mb-8 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => (
            <Link
              key={c.slug}
              to={`/templates/${c.slug}`}
              className="aura-chip shrink-0 whitespace-nowrap"
            >
              <span className={`h-2 w-2 rounded-full bg-gradient-to-br ${c.previewGradient}`} />
              {c.name}
              <span className="text-violet-300/45">{c.templateCount}</span>
            </Link>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-8">
          {[0, 1].map((r) => (
            <div key={r} className="animate-pulse space-y-3">
              <div className="h-4 w-40 rounded bg-white/10" />
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="aura-phone mx-auto aspect-[9/16] w-40 bg-white/[0.06] sm:w-44" />
                    <div className="mx-auto h-3 w-24 rounded bg-white/10" />
                    <div className="mx-auto h-7 w-24 rounded-lg bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-6 text-center">
          <p className="text-sm text-rose-100">{error}</p>
          <button type="button" onClick={() => void load()} className="aura-btn-ghost mt-4">
            {t('common.retry', { defaultValue: 'Retry' })}
          </button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-violet-300/60">{t('templates.noPublished', { defaultValue: 'No published templates yet.' })}</p>
      )}

      {!loading &&
        !error &&
        rows.map((row) => (
          <div key={row.category.slug} className="mb-10 last:mb-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold capitalize text-white">{row.category.name}</h3>
                <p className="mt-0.5 text-xs text-violet-300/60">{row.category.description}</p>
              </div>
              <Link
                to={`/templates/${row.category.slug}`}
                className="text-xs font-semibold text-fuchsia-300 transition hover:text-fuchsia-200"
              >
                {t('templates.openCategory', { defaultValue: 'Open category' })} →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {row.templates.map((tp) => (
                <TemplatePhoneCard key={tp.id} template={tp} />
              ))}
            </div>
          </div>
        ))}
    </section>
  );
}