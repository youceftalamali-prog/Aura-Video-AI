import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProductRecord, Project } from '@aura/types';
import { api } from '../lib/api';

const MAX_PRODUCTS = 4;
const MAX_PROJECTS = 3;

export function RecentItemsSection({ onPickProduct }: { onPickProduct: (product: ProductRecord) => void }) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listProducts().catch(() => [] as ProductRecord[]), api.listProjects().catch(() => [] as Project[])])
      .then(([p, pr]) => {
        if (cancelled) return;
        setProducts(p.slice(0, MAX_PRODUCTS));
        setProjects(pr.slice(0, MAX_PROJECTS));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-2">
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-lg font-extrabold tracking-tight text-white">{t('workspace.recentProducts')}</h2>
          <Link to="/products" className="text-xs font-semibold text-fuchsia-300 transition hover:text-fuchsia-200">
            {t('workspace.viewAll')} →
          </Link>
        </div>
        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center">
            <p className="text-sm text-violet-300/60">{t('workspace.noProducts')}</p>
            <Link to="/products/import" className="aura-btn-ghost mt-3 text-xs">
              {t('workspace.importFirstProduct')} →
            </Link>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPickProduct(p)}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-left transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]"
                title={t('agent.useProduct', { defaultValue: 'Use the product {{name}} for creating my ad.', name: p.name })}
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">🛍</span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-white">{p.name}</span>
                  {p.price && <span className="text-[11px] text-emerald-300">{p.price} {p.currency ?? ''}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-lg font-extrabold tracking-tight text-white">{t('workspace.recentProjects')}</h2>
          <Link to="/library" className="text-xs font-semibold text-fuchsia-300 transition hover:text-fuchsia-200">
            {t('workspace.viewAll')} →
          </Link>
        </div>
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-5 py-8 text-center">
            <p className="text-sm text-violet-300/60">{t('workspace.noProjects')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <Link key={p.id} to="/library" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]">
                {p.thumbnailUrl || p.videoUrl ? (
                  <video src={p.videoUrl ?? undefined} poster={p.thumbnailUrl ?? undefined} preload="none" className="h-12 w-16 shrink-0 rounded-lg bg-black object-cover" />
                ) : (
                  <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-base">📁</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-white">{p.name}</span>
                  <span className="text-[11px] text-violet-300/60">
                    {p.status} · {p.creditsUsed} <span className="text-fuchsia-300/70">{t('billing.creditsWord')}</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
