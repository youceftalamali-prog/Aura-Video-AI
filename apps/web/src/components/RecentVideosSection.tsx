import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Asset } from '@aura/types';
import { api } from '../lib/api';

interface UsageEntry {
  jobId: string;
  status: string;
  creditsCharged: number;
  mode: string | null;
  createdAt: string;
  completedAt: string | null;
}

const MAX_ROWS = 6;

const STATUS_STYLE: Record<string, string> = {
  queued: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  processing: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
  composing: 'border-sky-400/30 bg-sky-500/10 text-sky-200',
  rendering: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-200',
  completed: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
  failed: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
  canceled: 'border-white/15 bg-white/[0.05] text-violet-200/60',
};

export function RecentVideosSection() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Array<UsageEntry & { asset?: Asset; url?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overview, assets] = await Promise.all([api.getBillingOverview().catch(() => null), api.listAssets('video').catch(() => [] as Asset[])]);
      const usage = overview?.recentUsage ?? [];
      const assetByJob = new Map<string, Asset>();
      for (const a of assets) {
        const jobId = a.metadata?.jobId ?? a.metadata?.job_id;
        if (typeof jobId === 'string') assetByJob.set(jobId, a);
      }
      setRows(
        usage.slice(0, MAX_ROWS).map((u) => {
          const asset = assetByJob.get(u.jobId);
          return { ...u, asset, url: asset?.url ?? undefined };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t('library.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight text-white">{t('workspace.recentVideos')}</h2>
        <Link to="/library" className="text-xs font-semibold text-fuchsia-300 transition hover:text-fuchsia-200">
          {t('workspace.viewAll')} →
        </Link>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-white/10 bg-white/[0.05]" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4 text-center">
          <p className="text-sm text-rose-100">{error}</p>
          <button type="button" onClick={() => void load()} className="aura-btn-ghost mt-3">
            {t('common.retry')}
          </button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-center">
          <p className="text-sm text-violet-300/60">{t('workspace.noVideos')}</p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="grid gap-2.5 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.jobId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              {r.url ? (
                <video src={r.url} preload="none" controls playsInline className="h-20 w-12 shrink-0 rounded-lg bg-black object-cover" />
              ) : (
                <div className="flex h-20 w-12 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-lg">🎬</div>
              )}
              <div className="min-w-0 flex-1">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[r.status] ?? ''}`}>
                  {t(`status.${r.status}`, { defaultValue: r.status })}
                </span>
                <p className="mt-1 text-[11px] text-violet-300/60">
                  {new Date(r.createdAt).toLocaleString()} · {r.creditsCharged} <span className="text-fuchsia-300/70">{t('billing.creditsWord')}</span>
                </p>
              </div>
              {r.url && (
                <a href={r.url} download target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-violet-100 transition hover:border-fuchsia-400/50">
                  {t('common.download')}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
