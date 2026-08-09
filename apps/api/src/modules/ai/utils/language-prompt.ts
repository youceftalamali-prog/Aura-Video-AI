/** Build a system instruction so model replies in the requested language. */
export function languageSystemInstruction(lang?: string): string {
  const code = (lang || 'en').toLowerCase();
  const map: Record<string, string> = {
    en: 'Respond entirely in English.',
    fr: 'Réponds entièrement en français.',
    ar: 'أجب بالكامل باللغة العربية الفصحى الواضحة.',
  };
  return map[code] || `Respond entirely in the language with ISO code "${code}".`;
}

export function withLanguageContext<T extends Record<string, unknown>>(
  body: T,
  lang?: string,
): T & { language?: string } {
  if (!lang) return body;
  return { ...body, language: lang };
}
