import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  getEnabledLanguages,
  getLanguage,
  type LanguageCode,
  type LanguageMetadata,
  type TextDirection,
} from '@aura/i18n';
import { storeLanguage } from '../i18n';
import { api, getAccessToken } from '../lib/api';

export interface LanguageState {
  language: LanguageCode;
  locale: string;
  direction: TextDirection;
  meta: LanguageMetadata;
  enabledLanguages: LanguageMetadata[];
  interfaceLanguage: LanguageCode;
  aiOutputLanguage: LanguageCode;
  contentLanguage: LanguageCode;
  videoLanguage: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  setAiOutputLanguage: (code: LanguageCode) => void;
  setContentLanguage: (code: LanguageCode) => void;
  setVideoLanguage: (code: LanguageCode) => void;
}

const LanguageContext = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [language, setLangState] = useState<LanguageCode>((i18n.language as LanguageCode) || 'en');
  const [aiOutputLanguage, setAiOutputLanguage] = useState<LanguageCode>(language);
  const [contentLanguage, setContentLanguage] = useState<LanguageCode>(language);
  const [videoLanguage, setVideoLanguage] = useState<LanguageCode>(language);

  const meta = getLanguage(language);
  const direction = meta.direction;
  const locale = meta.locale;

  const setLanguage = useCallback(
    (code: LanguageCode) => {
      const m = getLanguage(code);
      if (!m.enabled) return;
      setLangState(m.code);
      setAiOutputLanguage(m.code);
      setContentLanguage(m.code);
      setVideoLanguage(m.code);
      void i18n.changeLanguage(m.code);
      storeLanguage(m.code);
      if (getAccessToken()) {
        void api.updatePreferredLanguage(m.code).catch(() => {
          /* offline / not configured — local still applied */
        });
      }
    },
    [i18n],
  );

  useEffect(() => {
    if (!getAccessToken()) return;
    void api.me().then((res) => {
      const pref = (res as { user?: { preferredLanguage?: string } }).user?.preferredLanguage
        || (res as { preferredLanguage?: string }).preferredLanguage;
      if (pref && ['en', 'fr', 'ar'].includes(pref)) {
        setLangState(pref as LanguageCode);
        setAiOutputLanguage(pref as LanguageCode);
        setContentLanguage(pref as LanguageCode);
        setVideoLanguage(pref as LanguageCode);
        void i18n.changeLanguage(pref);
        storeLanguage(pref);
      }
    }).catch(() => undefined);
  }, [i18n]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
    document.body.dir = direction;
  }, [language, direction]);

  const value = useMemo<LanguageState>(
    () => ({
      language,
      locale,
      direction,
      meta,
      enabledLanguages: getEnabledLanguages(),
      interfaceLanguage: language,
      aiOutputLanguage,
      contentLanguage,
      videoLanguage,
      setLanguage,
      setAiOutputLanguage,
      setContentLanguage,
      setVideoLanguage,
    }),
    [language, locale, direction, meta, aiOutputLanguage, contentLanguage, videoLanguage, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
