import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE } from '@aura/i18n';
import en from '../../../packages/i18n/locales/en.json';
import fr from '../../../packages/i18n/locales/fr.json';
import ar from '../../../packages/i18n/locales/ar.json';

const STORAGE_KEY = 'aura_language';

export function getStoredLanguage(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function storeLanguage(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: typeof window !== 'undefined' ? getStoredLanguage() : DEFAULT_LANGUAGE,
  fallbackLng: FALLBACK_LANGUAGE,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
