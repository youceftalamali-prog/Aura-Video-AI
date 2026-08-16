import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AiModelOption } from '@aura/types';

const QUALITY_LABEL: Record<string, string> = {
  vision: '🖼',
  creative: '✦',
  fast: '⚡',
  reasoning: '🧠',
  analysis: '🔍',
  multimodal: '🖼',
};

export function AgentModelPicker({
  models,
  loading,
  value,
  onChange,
}: {
  models: AiModelOption[];
  loading: boolean;
  value: string | null;
  onChange: (modelId: string | null) => void;
}) {
  const { t } = useTranslation();
  const selected = useMemo(() => models.find((m) => m.id === value) ?? null, [models, value]);

  return (
    <div className="min-w-0">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        disabled={loading}
        aria-label={t('agent.chooseModel')}
        className="w-full max-w-[15rem] cursor-pointer rounded-xl border border-white/10 bg-[#171124]/90 px-3 py-2 text-xs font-semibold text-violet-100 outline-none transition hover:border-fuchsia-400/50 disabled:opacity-50"
      >
        <option value="">{t('agent.defaultModel')}</option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.displayName} · {m.providerId}
          </option>
        ))}
      </select>

      {selected && (
        <div className="mt-1.5 block max-w-[15rem] space-y-0.5 text-[10px] leading-snug text-violet-300/70">
          {selected.capabilities.length > 0 && (
            <span className="block truncate">
              {selected.capabilities.slice(0, 4).map((c) => QUALITY_LABEL[c] ?? '◇').join(' ')}
              {' · '}
              {t('workspace.modelCapabilities', {
                defaultValue: '{{capabilities}} · {{context}} context',
                capabilities: selected.capabilities.join(', '),
                context: selected.contextLength ? `${(selected.contextLength / 1000).toFixed(0)}K` : t('common.unknown'),
              })}
            </span>
          )}
          {selected.pricing && (selected.pricing.prompt !== null || selected.pricing.completion !== null) && (
            <span className="block truncate">
              {t('workspace.modelPricing', {
                defaultValue: '{{prompt}} / 1K in · {{completion}} / 1K out',
                prompt: selected.pricing.prompt ?? '—',
                completion: selected.pricing.completion ?? '—',
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}