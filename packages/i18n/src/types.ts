export type TextDirection = 'ltr' | 'rtl';

/** ISO 639-1 style language codes used across Aura */
export type LanguageCode =
  | 'en'
  | 'fr'
  | 'ar'
  | 'es'
  | 'de'
  | 'it'
  | 'pt'
  | 'tr'
  | 'nl'
  | 'ru'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'hi'
  | 'id'
  | 'vi'
  | 'pl'
  | 'uk'
  | 'sv'
  | 'no'
  | 'da'
  | 'fi'
  | 'el'
  | 'he'
  | 'th'
  | 'ms'
  | 'ro'
  | 'cs'
  | 'hu';

export interface LanguageMetadata {
  code: LanguageCode;
  locale: string;
  name: string;
  nativeName: string;
  direction: TextDirection;
  enabled: boolean;
}

export interface LanguageContext {
  /** UI language */
  interfaceLanguage: LanguageCode;
  /** AI reply language */
  aiOutputLanguage: LanguageCode;
  /** Product analysis / creative content language */
  contentLanguage: LanguageCode;
  /** Script, captions, on-screen text, TTS language */
  videoLanguage: LanguageCode;
  locale: string;
  direction: TextDirection;
}

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
export const FALLBACK_LANGUAGE: LanguageCode = 'en';
