import { api } from './api';

export type DownloadState = 'idle' | 'preparing' | 'downloading' | 'complete' | 'failed';

/**
 * Secure download via the export API (ownership and readiness checked server-side).
 * Preview and download do not consume credits and do not publish to social media.
 */
export async function downloadAssetById(assetId: string): Promise<{ filename: string }> {
  const exp = await api.exportAsset(assetId);
  if (!exp.url) {
    throw new Error('ASSET_STORAGE_UNAVAILABLE');
  }
  const res = await fetch(exp.url);
  if (!res.ok) {
    throw new Error('VIDEO_DOWNLOAD_FAILED');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = exp.filename || exp.name || 'aura-video.mp4';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return { filename: exp.filename || exp.name };
}

/** Fallback for a verified output URL when no asset id exists. */
export async function downloadFromUrl(url: string, filename = 'aura-video.mp4'): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('VIDEO_DOWNLOAD_FAILED');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
