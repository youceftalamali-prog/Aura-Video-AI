import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProductRecord } from '@aura/types';

export type ComposerMode = 'text' | 'url' | 'image' | 'description' | 'product';

interface AgentComposerProps {
  products: ProductRecord[];
  productsLoading: boolean;
  busy: boolean;
  onSendText: (text: string) => void;
  onImportUrl: (url: string) => void;
  onImportImage: (file: File) => void;
  onImportDescription: (name: string, description: string) => void;
  onUseProduct: (productId: string) => void;
}

const MODES: Array<{ mode: ComposerMode; key: string; icon: string }> = [
  { mode: 'text', key: 'agent.modeText', icon: '✏️' },
  { mode: 'url', key: 'agent.modeUrl', icon: '🔗' },
  { mode: 'image', key: 'agent.modeImage', icon: '🖼' },
  { mode: 'description', key: 'agent.modeDescribe', icon: '📝' },
  { mode: 'product', key: 'agent.modeProduct', icon: '🗂' },
];

export function AgentComposer(props: AgentComposerProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ComposerMode>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [productId, setProductId] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const disabled = props.busy;
  const canSendText = text.trim().length > 0;

  const products = useMemo(() => (props.products ?? []).slice(0, 50), [props.products]);

  function submit() {
    if (disabled) return;
    if (mode === 'text') {
      if (!canSendText) return;
      const m = text.trim();
      setText('');
      props.onSendText(m);
    } else if (mode === 'url') {
      if (!url.trim()) return;
      const u = url.trim();
      setUrl('');
      setMode('text');
      props.onImportUrl(u);
    } else if (mode === 'image') {
      if (!selectedFile) return;
      const f = selectedFile;
      setSelectedFile(null);
      setMode('text');
      props.onImportImage(f);
    } else if (mode === 'description') {
      if (!name.trim() || !description.trim()) return;
      const n = name.trim();
      const d = description.trim();
      setName('');
      setDescription('');
      setMode('text');
      props.onImportDescription(n, d);
    } else if (mode === 'product') {
      if (!productId) return;
      const id = productId;
      setProductId('');
      setMode('text');
      props.onUseProduct(id);
    }
  }

  function selectMode(m: ComposerMode) {
    setMode(m);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-violet-300/60">{t('agent.howTo', { defaultValue: 'What do you need?' })}</span>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              onClick={() => selectMode(m.mode)}
              className={
                mode === m.mode
                  ? 'rounded-full border border-fuchsia-400/60 bg-fuchsia-500/20 px-3 py-1.5 text-xs font-semibold text-fuchsia-100'
                  : 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-violet-200/70 transition hover:border-white/25'
              }
            >
              {m.icon} {t(m.key)}
            </button>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition focus-within:border-fuchsia-400/50 ${mode === 'text' ? 'block' : 'hidden'}`}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder={t('agent.placeholder')}
          className="w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-violet-300/40"
        />
        <div className="flex items-center justify-between pt-2">
          <span className="text-[11px] text-violet-300/40">{t('agent.enterHint', { defaultValue: 'Enter to send · Shift+Enter for a new line' })}</span>
          <button type="button" onClick={submit} disabled={disabled || !canSendText} className="aura-btn-primary">
            {disabled ? t('common.working', { defaultValue: 'Working…' }) : t('agent.send')} →
          </button>
        </div>
      </div>

      <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${mode === 'url' ? 'block' : 'hidden'}`}>
        <label className="aura-label">{t('common.productUrl')}</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="https://example-store.com/product/…"
            className="aura-input"
          />
          <button type="button" onClick={submit} disabled={disabled || !url.trim()} className="aura-btn-primary shrink-0">
            {disabled ? t('common.working', { defaultValue: 'Analyzing…' }) : t('agent.analyzeLink', { defaultValue: 'Analyze link' })}
          </button>
        </div>
        <p className="mt-2 text-xs text-violet-300/60">{t('agent.urlHint', { defaultValue: 'Aura extracts the product name, brand, price, images and features.' })}</p>
      </div>

      <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${mode === 'image' ? 'block' : 'hidden'}`}>
        <label className="aura-label">{t('common.image')}</label>
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-violet-200 file:mr-3 file:rounded-lg file:border-0 file:bg-fuchsia-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-fuchsia-100"
          />
          {selectedFile && <p className="text-xs text-emerald-300">✓ {selectedFile.name}</p>}
          <div>
            <button type="button" onClick={submit} disabled={disabled || !selectedFile} className="aura-btn-primary">
              {t('agent.analyzeImage', { defaultValue: 'Analyze image' })}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-violet-300/60">{t('agent.imageHint', { defaultValue: 'Max 5MB · JPG, PNG, WEBP or GIF' })}</p>
      </div>

      <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${mode === 'description' ? 'block' : 'hidden'}`}>
        <div className="space-y-3">
          <div>
            <label className="aura-label">{t('common.productName')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="aura-input" placeholder={t('common.productName')} />
          </div>
          <div>
            <label className="aura-label">{t('common.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="aura-input resize-none"
              placeholder={t('agent.describeHint', { defaultValue: 'Describe your product, its features and its target market…' })}
            />
          </div>
          <button type="button" onClick={submit} disabled={disabled || !name.trim() || !description.trim()} className="aura-btn-primary">
            {disabled ? t('common.working', { defaultValue: 'Analyzing…' }) : t('agent.analyzeProduct', { defaultValue: 'Analyze product' })}
          </button>
        </div>
      </div>

      <div className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${mode === 'product' ? 'block' : 'hidden'}`}>
        <label className="aura-label">{t('agent.chooseProduct', { defaultValue: 'Choose an imported product' })}</label>
        {props.productsLoading && <p className="text-sm text-violet-300/60">{t('common.loading')}</p>}
        {!props.productsLoading && products.length === 0 && (
          <p className="text-sm text-violet-300/60">{t('agent.noProducts', { defaultValue: 'You have no imported products yet. Try pasting a product link.' })}</p>
        )}
        {products.length > 0 && (
          <div className="space-y-2">
            <div className="grid gap-1.5">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProductId(p.id);
                    setMode('text');
                    props.onUseProduct(p.id);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm transition hover:border-fuchsia-400/40 hover:bg-white/[0.06]"
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.06]">🛍</span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-white">{p.name}</span>
                    {p.price && <span className="text-xs text-emerald-300">{p.price} {p.currency ?? ''}</span>}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setMode('url')} className="text-xs text-fuchsia-300 hover:text-fuchsia-200">
              {t('agent.importNew', { defaultValue: 'Import a new product instead →' })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}