import type { TFunction } from 'i18next';

export function translateError(t: TFunction, err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: string }).code)
      : err && typeof err === 'object' && 'error' in err && typeof (err as { error: { code?: string } }).error === 'object'
        ? String((err as { error: { code?: string } }).error?.code || '')
        : '';
  if (code) {
    const key = `errors.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  if (err instanceof Error && err.message) return err.message;
  return t('errors.GENERIC');
}
