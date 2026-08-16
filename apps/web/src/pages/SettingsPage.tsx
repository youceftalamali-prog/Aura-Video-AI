import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, CardTitle, CardContent, Alert, Spinner, Badge } from '@aura/ui';
import { getEnabledLanguages } from '@aura/i18n';
import type {
  AiModelOption,
  AiStrategy,
  AppearancePreference,
  AspectRatioPreference,
  ResolutionPreference,
  UpdateUserPreferencesInput,
  UserPreferences,
  UserSettingsPayload,
} from '@aura/types';
import { AuraNav } from '../components/AuraNav';
import { api } from '../lib/api';

const DURATIONS = [15, 30, 45, 60] as const;
const ASPECT_RATIOS: AspectRatioPreference[] = ['16:9', '9:16', '1:1', '4:5'];
const RESOLUTIONS: ResolutionPreference[] = ['720p', '1080p', '4k'];

const selectClass =
  'rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100';
const labelClass = 'block text-sm font-medium text-slate-600';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<UserSettingsPayload | null>(null);
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const languages = getEnabledLanguages();

  useEffect(() => {
    (async () => {
      try {
        const [settings, modelList] = await Promise.all([
          api.getUserSettings(),
          api.listAiModels().catch(() => [] as AiModelOption[]),
        ]);
        setData(settings);
        setModels(modelList);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('settings.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(patch: UpdateUserPreferencesInput) {
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const updated = await api.updateUserSettings(patch);
      setData(updated);
      if (patch.language) {
        i18n.changeLanguage(patch.language);
      }
      setInfo(t('settings.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <>
        <AuraNav />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <AuraNav />
        <div className="mx-auto max-w-3xl px-4 py-10">
          <Alert variant="error" title={t('settings.loadFailed')}>{error ?? undefined}</Alert>
        </div>
      </>
    );
  }

  const prefs: UserPreferences = data.preferences;

  return (
    <>
      <AuraNav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">{t('settings.title')}</h1>
        <p className="mb-6 text-sm text-slate-500">{t('settings.subtitle')}</p>

        {error ? <div className="mb-4"><Alert variant="error" title={t('settings.saveFailed')} >{error}</Alert></div> : null}
        {info ? <div className="mb-4"><Alert variant="success">{info}</Alert></div> : null}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('settings.profile')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
                {(data.profile.fullName || data.profile.email).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{data.profile.fullName}</p>
                <p className="truncate text-sm text-slate-500">{data.profile.email}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {data.profile.emailVerifiedAt ? (
                  <Badge variant="success">{t('settings.verified')}</Badge>
                ) : (
                  <Badge variant="danger">{t('settings.unverified')}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('settings.languageTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <label className={labelClass}>{t('settings.language')}</label>
            <select
              className={`${selectClass} mt-1 w-full max-w-xs`}
              value={prefs.language ?? data.resolved.language}
              onChange={(e) => save({ language: e.target.value })}
              disabled={saving}
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('settings.appearanceTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {(['light', 'dark', 'system'] as AppearancePreference[]).map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    (prefs.appearance ?? data.resolved.appearance) === value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="appearance"
                    className="sr-only"
                    checked={(prefs.appearance ?? data.resolved.appearance) === value}
                    onChange={() => save({ appearance: value })}
                  />
                  {t(`settings.appearance_${value}`)}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('settings.aiTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className={labelClass}>{t('settings.defaultModel')}</label>
              <select
                className={`${selectClass} mt-1 w-full max-w-xs`}
                value={prefs.defaultAiModel ?? ''}
                onChange={(e) => save({ defaultAiModel: e.target.value || null })}
                disabled={saving}
              >
                <option value="">{t('settings.modelPlatformDefault')}</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">{t('settings.modelHint', { count: models.length })}</p>
            </div>
            <div>
              <label className={labelClass}>{t('settings.strategy')}</label>
              <div className="mt-1 flex flex-wrap gap-3">
                {(['fast', 'balanced', 'smart'] as AiStrategy[]).map((value) => (
                  <label
                    key={value}
                    className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      (prefs.aiStrategy ?? data.resolved.ai.strategy) === value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="aiStrategy"
                      className="sr-only"
                      checked={(prefs.aiStrategy ?? data.resolved.ai.strategy) === value}
                      onChange={() => save({ aiStrategy: value })}
                    />
                    <span className="font-semibold capitalize">{value}</span>
                    <span className="ml-2 hidden text-xs text-slate-400 sm:inline">
                      {t(`settings.strategy_${value}`)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('settings.videoTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>{t('settings.defaultDuration')}</label>
              <select
                className={`${selectClass} mt-1 w-full`}
                value={prefs.defaultVideoDuration ?? ''}
                onChange={(e) => save({ defaultVideoDuration: e.target.value ? Number(e.target.value) : null })}
                disabled={saving}
              >
                <option value="">{t('settings.platformDefault')}</option>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('settings.aspectRatio')}</label>
              <select
                className={`${selectClass} mt-1 w-full`}
                value={prefs.defaultAspectRatio ?? ''}
                onChange={(e) => save({ defaultAspectRatio: (e.target.value || null) as AspectRatioPreference | null })}
                disabled={saving}
              >
                <option value="">{t('settings.platformDefault')}</option>
                {ASPECT_RATIOS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('settings.resolution')}</label>
              <select
                className={`${selectClass} mt-1 w-full`}
                value={prefs.defaultResolution ?? ''}
                onChange={(e) => save({ defaultResolution: (e.target.value || null) as ResolutionPreference | null })}
                disabled={saving}
              >
                <option value="">{t('settings.platformDefault')}</option>
                {RESOLUTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('settings.videoLanguage')}</label>
              <select
                className={`${selectClass} mt-1 w-full`}
                value={prefs.defaultVideoLanguage ?? ''}
                onChange={(e) => save({ defaultVideoLanguage: e.target.value || null })}
                disabled={saving}
              >
                <option value="">{t('settings.platformDefault')}</option>
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('settings.notificationsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(
              [
                ['emailAlerts', 'settings.notifEmailAlerts'],
                ['marketing', 'settings.notifMarketing'],
                ['agentUpdates', 'settings.notifAgentUpdates'],
                ['billing', 'settings.notifBilling'],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-indigo-600"
                  checked={prefs.notifications[key] === true}
                  onChange={(e) =>
                    save({ notifications: { ...prefs.notifications, [key]: e.target.checked } })
                  }
                />
                {t(label)}
              </label>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('settings.securityTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
              <span>{t('settings.accountEmail')}</span>
              <span className="font-medium text-slate-900">{data.profile.email}</span>
            </div>
            <p className="text-xs text-slate-400">{t('settings.securityHint')}</p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('settings.subscriptionTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-600">{t('settings.subscriptionHint')}</p>
            <Link to="/billing" className="ml-auto">
              <Button size="sm">{t('settings.openBilling')}</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    </>
  );
}