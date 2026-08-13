import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductRecord } from '@aura/types';

export function ProductPickerModal({
  open,
  products,
  loading,
  onClose,
  onSelect,
  onImport,
}: {
  open: boolean;
  products: ProductRecord[];
  loading: boolean;
  onClose: () => void;
  onSelect: (product: ProductRecord) => void;
  onImport: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q));
  }, [products, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t('agent.chooseProduct')}
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-[#151023]/95 shadow-[0_0_60px_rgba(147,87,246,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-white">{t('agent.chooseProduct')}</h3>
            <p className="text-[11px] text-violet-300/70">{t('agent.productPickHint')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-violet-200 hover:border-rose-400/40 hover:text-rose-200">
            ✕
          </button>
        </div>

        <div className="p-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search', { defaultValue: 'Search…' })}
            autoFocus
            className="aura-input"
          />
        </div>

        <div className="max-h-[46vh] space-y-1.5 overflow-y-auto px-4 pb-3">
          {loading && <p className="py-6 text-center text-sm text-violet-300/60">{t('common.loading')}</p>}
          {!loading && filtered.length === 0 && (
            <div className="py-6 text-center">
              <p className="text-sm text-violet-300/60">
                {products.length === 0 ? t('workspace.noProducts') : t('common.noResults', { defaultValue: 'No results' })}
              </p>
            </div>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-fuchsia-400/40 hover:bg-white/[0.07]"
            >
              {p.imageUrl ? (
                <img src={p.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-lg">🛍</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{p.name}</span>
                <span className="block truncate text-[11px] text-violet-300/60">
                  {p.description || new Date(p.createdAt).toLocaleDateString()}
                </span>
              </span>
              {p.price && <span className="shrink-0 text-xs font-semibold text-emerald-300">{p.price} {p.currency ?? ''}</span>}
            </button>
          ))}
        </div>

        <div className="border-t border-white/10 px-4 py-3">
          <button type="button" onClick={onImport} className="aura-btn-ghost w-full text-xs">
            {t('agent.importNewProduct')} →
          </button>
        </div>
      </div>
    </div>
  );
}