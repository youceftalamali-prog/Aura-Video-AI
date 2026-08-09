export type AppLanguageCode = 'en' | 'fr' | 'ar' | string;

export interface LanguagePreferences {
  interfaceLanguage: AppLanguageCode;
  aiOutputLanguage: AppLanguageCode;
  contentLanguage: AppLanguageCode;
  videoLanguage: AppLanguageCode;
}

export interface WithLanguageContext {
  language?: AppLanguageCode;
  aiOutputLanguage?: AppLanguageCode;
  contentLanguage?: AppLanguageCode;
  videoLanguage?: AppLanguageCode;
}
