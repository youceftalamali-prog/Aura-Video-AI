import { useTranslation } from 'react-i18next';
import type { AiStrategy } from '@aura/types';

const OPTIONS: Array<{ value: AiStrategy; key: string; icon: string }> = [
  { value: 'fast', key: 'agent.fast', icon: '⚡' },
  { value: 'balanced', key: 'agent.balanced', icon: '◐' },
  { value: 'smart', key: 'agent.smart', icon: '✦' },
];

/** Pure strategy selector — routing decisions stay on the backend. */
export function AgentStrategyPicker({ value, onChange }: { value: AiStrategy; onChange: (strategy: AiStrategy) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('agent.strategyPick')}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={
            value === o.value
              ? 'rounded-full border border-fuchsia-400/60 bg-fuchsia-500/20 px-3 py-1.5 text-xs font-semibold text-fuchsia-100'
              : 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-violet-200/70 transition hover:border-white/25 hover:text-white'
          }
        >
          <span className="me-1">{o.icon}</span>
          {t(o.key)}
        </button>
      ))}
    </div>
  );
}