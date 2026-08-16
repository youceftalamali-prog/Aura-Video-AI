import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LibraryTemplate, LibraryTemplateCategory } from '@aura/types';
import { api } from '../lib/api';

const PER_CATEGORY = 6;

export function SmartTemplatesSection({ onUseTemplate }: { onUseTemplate: (template: LibraryTemplate) => void }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<LibraryTemplateCategory[]>([]);
  const [templates, setTemplates] = useState<LibraryTemplate[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cats, all] = await Promise.all([api.listTemplateCategories(), api.listTemplates()]);
      setCategories(cats);
      setTemplates(all);
      if (activeCategory === 'all' && cats.length > 0) {
        setActiveCategory(cats[0]!.slug);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('templates.failedToLoad', { defaultValue: 'Failed to load templates.' }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = activeCategory === 'all' ? templates.slice(0, PER_CATEGORY) : templates.filter((tp) => tp.category === activeCategory).slice(0, PER_CATEGORY);

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-white">{t('workspace.smartTemplates')}</h2>
          <p className="text-xs text-violet-300/60">{t('templates.chooseCategory')}</p>
        </div>
        <Link to="/templates" className="text-xs font-semibold text-fuchsia-300 transition hover:text-fuchsia-200">
          {t('workspace.viewAll')} →
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-center">
          <p className="text-sm text-rose-100">{error}</p>
          <button type="button" onClick={() => void load()} className="aura-btn-ghost mt-3">
            {t('common.retry')}
          </button>
        </div>
      )}

      {!error && categories.length > 0 && (
        <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabButton active={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>
            {t('templates.all', { defaultValue: 'All' })}
          </TabButton>
          {categories.map((c) => (
            <TabButton key={c.slug} active={activeCategory === c.slug} onClick={() => setActiveCategory(c.slug)}>
              {c.name}
              <span className="text-violet-300/45">{c.templateCount}</span>
            </TabButton>
          ))}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.06] pb-2">
                <div className="aspect-[9/16] bg-white/[0.04]" />
                <div className="mx-2 mt-2 h-3 rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <p className="text-sm text-violet-300/60">{t('templates.noPublished', { defaultValue: 'No published templates yet.' })}</p>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {visible.map((tp) => (
            <SmartTemplateCard key={tp.id} template={tp} onUseTemplate={onUseTemplate} />
          ))}
        </div>
      )}
    </section>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-fuchsia-400/60 bg-fuchsia-500/20 px-3 py-1.5 text-xs font-semibold text-fuchsia-100'
          : 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-violet-200/70 transition hover:border-white/25 hover:text-white'
      }
    >
      {children}
    </button>
  );
}

function SmartTemplateCard({ template, onUseTemplate }: { template: LibraryTemplate; onUseTemplate: (template: LibraryTemplate) => void }) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !template.previewVideoUrl || !template.hasRealPreview) return;
    if (hover) v.play().catch(() => undefined);
    else {
      v.pause();
      v.currentTime = 0;
    }
  }, [hover, template]);

  return (
    <div
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-fuchsia-400/40 hover:shadow-[0_0_40px_rgba(168,85,247,0.25)]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative aspect-[9/16] w-full">
        <div className="flex h-full w-full items-center justify-center px-4 py-3 text-center">
          <div className="aura-phone mx-auto h-full w-full max-w-[10rem]">
            {template.hasRealPreview && template.previewVideoUrl ? (
              <video ref={videoRef} src={template.previewVideoUrl} muted playsInline loop preload="none" className="h-full w-full object-cover" />
            ) : template.thumbnailUrl ? (
              <img src={template.thumbnailUrl} alt={template.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col justify-end bg-gradient-to-br from-zinc-900 via-[#171225] to-black p-3 text-left">
                <span className="text-[9px] font-bold uppercase tracking-widest text-fuchsia-300/90">{template.category}</span>
                <span className="mt-0.5 text-sm font-semibold leading-snug text-white drop-shadow">{template.name}</span>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-100">{template.durationSeconds ?? 0}s</span>
                  <span className="rounded bg-fuchsia-500/25 px-1.5 py-0.5 text-[9px] font-semibold text-fuchsia-100">{template.aspectRatio}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {template.isPremium && (
          <span className="absolute right-2 top-2 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black">
            {t('templates.premium', { defaultValue: 'Premium' })}
          </span>
        )}
      </div>
      <div className="border-t border-white/[0.07] p-2.5">
        <p className="truncate text-[13px] font-semibold text-white" title={template.name}>
          {template.name}
        </p>
        <p className="text-[11px] capitalize text-violet-300/70">
          {template.category}
          {template.tags.length > 0 && <span className="text-violet-300/40"> · {template.tags.slice(0, 2).join(', ')}</span>}
        </p>
        <button
          type="button"
          onClick={() => onUseTemplate(template)}
          className="mt-2 w-full rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:from-fuchsia-500 hover:to-violet-500"
        >
          {t('workspace.useTemplate')} →
        </button>
      </div>
    </div>
  );
}