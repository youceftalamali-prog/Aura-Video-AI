import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Alert, Spinner } from '@aura/ui';
import { api } from '../lib/api';
import { downloadAssetById, downloadFromUrl, type DownloadState } from '../lib/download';

export interface VideoResultCardProps {
  title?: string;
  videoUrl: string | null;
  assetId?: string | null;
  durationSeconds?: number | null;
  resolution?: string | null;
  aspectRatio?: string | null;
  status?: string;
  sizeBytes?: number | null;
  createdAt?: string | null;
}

export function VideoResultCard({
  title,
  videoUrl,
  assetId,
  durationSeconds,
  resolution,
  aspectRatio,
  status = 'completed',
  sizeBytes,
  createdAt,
}: VideoResultCardProps) {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(videoUrl);
  const [previewLoading, setPreviewLoading] = useState(Boolean(assetId));
  const [dl, setDl] = useState<DownloadState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setPreviewUrl(videoUrl);
    setError(null);

    if (!assetId) {
      setPreviewLoading(false);
      return () => { mounted = false; };
    }

    setPreviewLoading(true);
    // Resolve a fresh signed URL for preview. The job's persisted output URL
    // may have expired; export/download always uses the asset id as well.
    api.getAsset(assetId)
      .then((asset) => {
        if (mounted) setPreviewUrl(asset.url || videoUrl || null);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'ASSET_PREVIEW_UNAVAILABLE');
      })
      .finally(() => {
        if (mounted) setPreviewLoading(false);
      });

    return () => { mounted = false; };
  }, [assetId, videoUrl]);

  const terminal = status === 'completed' || status === 'ready';
  const deliverable = terminal && Boolean(assetId || previewUrl);
  const ready = terminal && Boolean(previewUrl);

  async function onDownload() {
    setError(null);
    setDl('preparing');
    try {
      if (assetId) {
        await downloadAssetById(assetId);
      } else if (previewUrl) {
        await downloadFromUrl(previewUrl, 'aura-video.mp4');
      } else {
        throw new Error('ASSET_NOT_READY');
      }
      setDl('complete');
    } catch (err) {
      setDl('failed');
      setError(err instanceof Error ? err.message : 'VIDEO_DOWNLOAD_FAILED');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{deliverable ? (title || t('video.ready')) : t('video.processing')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {previewLoading && (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Spinner size="sm" />
            <span>{t('video.preparing')}</span>
          </div>
        )}

        {!previewLoading && !ready && (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <Spinner size="sm" />
            <span>{t('video.preparing')}</span>
          </div>
        )}

        {ready && previewUrl && (
          <video
            src={previewUrl}
            controls
            playsInline
            preload="metadata"
            className="max-h-[28rem] w-full rounded-xl bg-black"
          />
        )}

        <div className="space-y-1 text-sm">
          <p className="font-medium text-slate-900">{title}</p>
          <div className="flex flex-wrap gap-2">
            {durationSeconds != null && <Badge variant="default">{durationSeconds}s</Badge>}
            {resolution && <Badge variant="default">{resolution}</Badge>}
            {aspectRatio && <Badge variant="info">{aspectRatio}</Badge>}
            {sizeBytes != null && sizeBytes > 0 && (
              <Badge variant="default">{(sizeBytes / (1024 * 1024)).toFixed(2)} MB</Badge>
            )}
            {createdAt && (
              <span className="text-xs text-slate-400">{new Date(createdAt).toLocaleString()}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            className="w-full sm:w-auto"
            disabled={!deliverable || dl === 'downloading' || dl === 'preparing'}
            loading={dl === 'downloading' || dl === 'preparing'}
            onClick={onDownload}
          >
            {dl === 'complete' ? t('common.download') : t('video.downloadVideo')}
          </Button>
          <Link to="/library" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full">{t('video.openLibrary')}</Button>
          </Link>
          <Link to="/video" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full">{t('nav.video')}</Button>
          </Link>
        </div>

        {dl === 'complete' && (
          <p className="text-xs text-emerald-600">{t('video.downloadComplete')}</p>
        )}
        {dl === 'failed' && (
          <p className="text-xs text-red-600">{t('video.downloadFailedRetry')}</p>
        )}
        <p className="text-xs text-slate-400">{t('video.previewDownloadFree')}</p>
      </CardContent>
    </Card>
  );
}
