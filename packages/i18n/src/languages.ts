import type { LanguageCode, LanguageMetadata } from './types.js';

/**
 * Central language registry. Add a new language by appending metadata
 * and providing a translation dictionary under packages/i18n/locales/{code}.json
 * then enable it (enabled: true).
 */
export const LANGUAGES: Record<LanguageCode, LanguageMetadata> = {
  en: { code: 'en', locale: 'en-US', name: 'English', nativeName: 'English', direction: 'ltr', enabled: true },
  fr: { code: 'fr', locale: 'fr-FR', name: 'French', nativeName: 'Français', direction: 'ltr', enabled: true },
  ar: { code: 'ar', locale: 'ar-DZ', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', enabled: true },
  es: { code: 'es', locale: 'es-ES', name: 'Spanish', nativeName: 'Español', direction: 'ltr', enabled: false },
  de: { code: 'de', locale: 'de-DE', name: 'German', nativeName: 'Deutsch', direction: 'ltr', enabled: false },
  it: { code: 'it', locale: 'it-IT', name: 'Italian', nativeName: 'Italiano', direction: 'ltr', enabled: false },
  pt: { code: 'pt', locale: 'pt-BR', name: 'Portuguese', nativeName: 'Português', direction: 'ltr', enabled: false },
  tr: { code: 'tr', locale: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe', direction: 'ltr', enabled: false },
  nl: { code: 'nl', locale: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands', direction: 'ltr', enabled: false },
  ru: { code: 'ru', locale: 'ru-RU', name: 'Russian', nativeName: 'Русский', direction: 'ltr', enabled: false },
  zh: { code: 'zh', locale: 'zh-CN', name: 'Chinese', nativeName: '中文', direction: 'ltr', enabled: false },
  ja: { code: 'ja', locale: 'ja-JP', name: 'Japanese', nativeName: '日本語', direction: 'ltr', enabled: false },
  ko: { code: 'ko', locale: 'ko-KR', name: 'Korean', nativeName: '한국어', direction: 'ltr', enabled: false },
  hi: { code: 'hi', locale: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', enabled: false },
  id: { code: 'id', locale: 'id-ID', name: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr', enabled: false },
  vi: { code: 'vi', locale: 'vi-VN', name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr', enabled: false },
  pl: { code: 'pl', locale: 'pl-PL', name: 'Polish', nativeName: 'Polski', direction: 'ltr', enabled: false },
  uk: { code: 'uk', locale: 'uk-UA', name: 'Ukrainian', nativeName: 'Українська', direction: 'ltr', enabled: false },
  sv: { code: 'sv', locale: 'sv-SE', name: 'Swedish', nativeName: 'Svenska', direction: 'ltr', enabled: false },
  no: { code: 'no', locale: 'nb-NO', name: 'Norwegian', nativeName: 'Norsk', direction: 'ltr', enabled: false },
  da: { code: 'da', locale: 'da-DK', name: 'Danish', nativeName: 'Dansk', direction: 'ltr', enabled: false },
  fi: { code: 'fi', locale: 'fi-FI', name: 'Finnish', nativeName: 'Suomi', direction: 'ltr', enabled: false },
  el: { code: 'el', locale: 'el-GR', name: 'Greek', nativeName: 'Ελληνικά', direction: 'ltr', enabled: false },
  he: { code: 'he', locale: 'he-IL', name: 'Hebrew', nativeName: 'עברית', direction: 'rtl', enabled: false },
  th: { code: 'th', locale: 'th-TH', name: 'Thai', nativeName: 'ไทย', direction: 'ltr', enabled: false },
  ms: { code: 'ms', locale: 'ms-MY', name: 'Malay', nativeName: 'Bahasa Melayu', direction: 'ltr', enabled: false },
  ro: { code: 'ro', locale: 'ro-RO', name: 'Romanian', nativeName: 'Română', direction: 'ltr', enabled: false },
  cs: { code: 'cs', locale: 'cs-CZ', name: 'Czech', nativeName: 'Čeština', direction: 'ltr', enabled: false },
  hu: { code: 'hu', locale: 'hu-HU', name: 'Hungarian', nativeName: 'Magyar', direction: 'ltr', enabled: false },
};

export function getEnabledLanguages(): LanguageMetadata[] {
  return Object.values(LANGUAGES).filter((l) => l.enabled);
}

export function getLanguage(code: string): LanguageMetadata {
  const lang = LANGUAGES[code as LanguageCode];
  if (lang) return lang;
  return LANGUAGES.en;
}

export function isRtl(code: string): boolean {
  return getLanguage(code).direction === 'rtl';
}

export function isLanguageSupported(code: string): boolean {
  const lang = LANGUAGES[code as LanguageCode];
  return Boolean(lang?.enabled);
}
