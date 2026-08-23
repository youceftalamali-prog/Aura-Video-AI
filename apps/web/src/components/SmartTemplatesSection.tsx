import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LibraryTemplate, LibraryTemplateCategory } from '@aura/types';
import { api } from '../lib/api';

const PER_CATEGORY = 6;

const CATEGORY_VISUALS: Record<string, { emoji: string; gradient: string; frames: string[] }> = {
  ecommerce: { emoji: '🛍️', gradient: 'from-violet-200 via-fuchsia-300 to-zinc-950', frames: ['Hook', 'Product', 'CTA'] },
  beauty: { emoji: '🌸', gradient: 'from-rose-100 via-pink-300 to-purple-950', frames: ['Texture', 'Glow', 'Routine'] },
  fashion: { emoji: '👕', gradient: 'from-fuchsia-200 via-violet-500 to-slate-950', frames: ['Drop', 'Fit', 'Offer'] },
  food: { emoji: '🍔', gradient: 'from-lime-100 via-green-400 to-amber-950', frames: ['Close-up', 'Taste', 'Order'] },
  tech: { emoji: '📱', gradient: 'from-cyan-200 via-blue-500 to-slate-950', frames: ['Problem', 'Feature', 'Proof'] },
  fitness: { emoji: '🏋️', gradient: 'from-orange-200 via-red-500 to-black', frames: ['Move', 'Power', 'Result'] },
  real_estate: { emoji: '🏠', gradient: 'from-emerald-100 via-teal-400 to-slate-950', frames: ['Before', 'Tour', 'Contact'] },
  services: { emoji: '💼', gradient: 'from-sky-100 via-indigo-400 to-zinc-950', frames: ['Need', 'Solution', 'Book'] },
  default: { emoji: '🎬', gradient: 'from-indigo-200 via-violet-500 to-black', frames: ['Problem', 'Solution', 'CTA'] },
};

function visualFor(template: LibraryTemplate) {
  const keys = [template.category, template.subCategory ?? '', ...(template.tags ?? [])].map((value) => value.toLowerCase().replace(/\s+/g, '_'));
  for (const key of keys) {
    if (CATEGORY_VISUALS[key]) return CATEGORY_VISUALS[key];
    if (key.includes('beauty')) return CATEGORY_VISUALS.beauty;
    if (key.includes('fashion')) return CATEGORY_VISUALS.fashion;
    if (key.includes('food') || key.includes('restaurant')) return CATEGORY_VISUALS.food;
    if (key.includes('tech') || key.includes('electronic')) return CATEGORY_VISUALS.tech;
    if (key.includes('fitness')) return CATEGORY_VISUALS.fitness;
    if (key.includes('home') || key.includes('real')) return CATEGORY_VISUALS.real_estate;
    if (key.includes('service')) return CATEGORY_VISUALS.services;
  }
  return CATEGORY_VISUALS.default;
}

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
      if (activeCategory === 'all' && cats.length > 0) setActiveCategory(cats[0]!.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('templates.failedToLoad', { defaultValue: 'Failed to load templates.' }));
    } finally {
      setLoading(false);
    }
  }, [activeCategory, t]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = activeCategory === 'all' ? templates.slice(0, PER_CATEGORY) : templates.filter((tp) => tp.category === activeCategory).slice(0, PER_CATEGORY);

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-zinc-950">{t('workspace.smartTemplates')}</h2>
          <p className="text-sm text-zinc-500">{t('templates.chooseCategory')}</p>
        </div>
        <Link to="/templates" className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-violet-700 shadow-sm ring-1 ring-violet-100 transition hover:bg-violet-50">
          {t('workspace.viewAll')} →
        </Link>
      </div>

      {error && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-center">
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
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
              <span className="text-zinc-400">{c.templateCount}</span>
            </TabButton>
          ))}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-200">
              <div className="aspect-[9/16] animate-pulse bg-zinc-100" />
              <div className="space-y-2 p-3">
                <div className="h-3 animate-pulse rounded bg-zinc-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <p className="rounded-3xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">{t('templates.noPublished', { defaultValue: 'No published templates yet.' })}</p>
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
          ? 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-violet-300 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 shadow-sm'
          : 'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 shadow-sm transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700'
      }
    >
      {children}
    </button>
  );
}

function TemplateFallbackVisual({ template }: { template: LibraryTemplate }) {
  const visual = visualFor(template);
  const frames = template.scenes?.length ? template.scenes.slice(0, 3).map((scene) => scene.title || scene.description || 'Scene') : visual.frames;
  return (
    <div className={`flex h-full flex-col justify-between bg-gradient-to-br ${visual.gradient} p-3 text-white`}>
      <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.18em] text-white/75">
        <span>Aura</span>
        <span>{template.aspectRatio}</span>
      </div>
      <div className="text-center">
        <div className="text-4xl drop-shadow-lg">{visual.emoji}</div>
        <p className="mt-2 line-clamp-2 text-sm font-black leading-tight drop-shadow">{template.name}</p>
      </div>
      <div className="space-y-1.5">
        {frames.map((frame, index) => (
          <div key={`${frame}-${index}`} className="flex items-center gap-1.5 rounded-full bg-black/25 px-2 py-1 text-[9px] font-bold backdrop-blur">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] text-zinc-950">{index + 1}</span>
            <span className="truncate">{frame}</span>
          </div>
        ))}
      </div>
    </div>
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
      className="group flex flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-xl"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="relative bg-zinc-100 p-3">
        <div className="aura-phone mx-auto aspect-[9/16] w-full max-w-[9rem] border-[5px] border-zinc-950 shadow-xl">
          {template.hasRealPreview && template.previewVideoUrl ? (
            <video ref={videoRef} src={template.previewVideoUrl} muted playsInline loop preload="metadata" className="h-full w-full object-cover" />
          ) : template.thumbnailUrl ? (
            <img src={template.thumbnailUrl} alt={template.name} className="h-full w-full object-cover" />
          ) : (
            <TemplateFallbackVisual template={template} />
          )}
        </div>
        {template.isPremium && (
          <span className="absolute right-2 top-2 rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-black shadow-sm">
            {t('templates.premium', { defaultValue: 'Premium' })}
          </span>
        )}
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white">
          {template.durationSeconds ?? 15}s
        </span>
      </div>
      <div className="flex flex-1 flex-col border-t border-zinc-100 p-3">
        <p className="line-clamp-2 min-h-[2.25rem] text-[13px] font-black leading-snug text-zinc-950" title={template.name}>
          {template.name}
        </p>
        <p className="mt-1 text-[11px] capitalize text-zinc-500">
          {template.category}
          {template.tags.length > 0 && <span className="text-zinc-400"> · {template.tags.slice(0, 2).join(', ')}</span>}
        </p>
        <button
          type="button"
          onClick={() => onUseTemplate(template)}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-violet-600 to-emerald-500 px-3 py-2 text-xs font-black text-white transition hover:brightness-110"
        >
          {t('workspace.useTemplate')} →
        </button>
      </div>
    </div>
  );
}
