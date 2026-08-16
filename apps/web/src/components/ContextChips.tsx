import { useTranslation } from 'react-i18next';
import type { LibraryTemplate, ProductRecord } from '@aura/types';

export function ContextChips({
  product,
  template,
  onPickProduct,
}: {
  product: ProductRecord | null;
  template: LibraryTemplate | null;
  onPickProduct: () => void;
}) {
  const { t } = useTranslation();
  if (!product && !template) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {product && (
        <button
          type="button"
          onClick={onPickProduct}
          title={t('agent.clearSelection', { defaultValue: 'Change product' })}
          className="flex items-center gap-2 rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 py-1 pe-2.5 ps-3 text-xs font-medium text-fuchsia-100 transition hover:border-fuchsia-400/70"
        >
          <span className="text-[10px] uppercase tracking-wider text-fuchsia-300/80">{t('agent.selectedProduct')}</span>
          {product.imageUrl && <img src={product.imageUrl} alt="" className="h-5 w-5 rounded-full object-cover" />}
          <span className="max-w-[10rem] truncate font-semibold">{product.name}</span>
        </button>
      )}
      {template && (
        <span className="flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 py-1 pe-3 ps-3 text-xs font-medium text-violet-100">
          <span className="text-[10px] uppercase tracking-wider text-violet-300/80">{t('agent.selectedTemplate')}</span>
          <span className="max-w-[10rem] truncate font-semibold">{template.name}</span>
        </span>
      )}
    </div>
  );
}