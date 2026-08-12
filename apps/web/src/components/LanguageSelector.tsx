import { useTranslation } from 'react-i18next';
import { useLanguage } from '../language/LanguageProvider';
import type { LanguageCode } from '@aura/i18n';

export function LanguageSelector({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { language, enabledLanguages, setLanguage } = useLanguage();
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <select
        className="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-sm text-violet-100 outline-none transition focus:border-fuchsia-400/50"
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        aria-label={t('common.language')}
      >
        {enabledLanguages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
