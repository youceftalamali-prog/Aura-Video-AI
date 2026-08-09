import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';
import type {
  MediaGenerateVideoParams,
  MediaJobStatusResult,
  MediaProviderCapabilities,
  MediaProviderName,
  VideoGenerationMode,
} from '@aura/types';
import type {
  IMediaGenerationProvider,
  MediaSubmitResult,
} from '../interfaces/media-provider.interface.js';

export class OpenAIMediaProvider implements IMediaGenerationProvider {
  readonly name: MediaProviderName = 'openai';

  capabilities(): MediaProviderCapabilities {
    return { textToVideo: true, imageToVideo: true, asyncJobs: true, cancel: true };
  }

  isConfigured(): boolean {
    const env = getEnv();
    return Boolean(env.MEDIA_API_KEY || env.AI_API_KEY);
  }

  supportsMode(mode: VideoGenerationMode): boolean {
    const caps = this.capabilities();
    if (mode === 'image_to_video') return caps.imageToVideo;
    return caps.textToVideo;
  }

  private get apiKey(): string {
    const env = getEnv();
    const key = env.MEDIA_API_KEY || env.AI_API_KEY;
    if (!key) {
      throw new AppError('Media provider is not configured. Set MEDIA_API_KEY.', 503, 'VIDEO_PROVIDER_NOT_CONFIGURED');
    }
    return key;
  }

  private get baseUrl(): string {
    const env = getEnv();
    return (env.MEDIA_BASE_URL || env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async generateVideo(params: MediaGenerateVideoParams): Promise<MediaSubmitResult> {
    if (!this.isConfigured()) {
      throw new AppError('Media provider is not configured', 503, 'VIDEO_PROVIDER_NOT_CONFIGURED');
    }
    const mode = params.mode ?? (params.sourceImageUrl ? 'image_to_video' : 'text_to_video');
    if (!this.supportsMode(mode)) {
      throw new AppError(`Provider does not support mode: ${mode}`, 400, 'INVALID_VIDEO_INPUT');
    }
    const env = getEnv();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.MEDIA_TIMEOUT_MS);
    const body: Record<string, unknown> = {
      model: (env as { MEDIA_VIDEO_MODEL?: string }).MEDIA_VIDEO_MODEL || 'sora-2',
      prompt: params.prompt,
      seconds: String(Math.min(Math.max(params.duration, 4), 20)),
      size: this.mapAspect(params.aspectRatio),
    };
    if (mode === 'image_to_video' && params.sourceImageUrl) {
      body.input_reference = { image_url: params.sourceImageUrl };
    }
    try {
      const response = await fetch(`${this.baseUrl}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.status === 404 || response.status === 405) {
        throw new AppError('Configured media provider does not expose a usable video generation API', 503, 'VIDEO_PROVIDER_UNAVAILABLE');
      }
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new AppError(`Video provider error: ${response.status}`, 502, 'VIDEO_GENERATION_FAILED', { status: response.status, body: errBody.slice(0, 400) });
      }
      const data = (await response.json()) as { id?: string; status?: string };
      if (!data.id) throw new AppError('Video provider returned no job id', 502, 'VIDEO_GENERATION_FAILED');
      return { providerJobId: data.id, status: data.status === 'processing' || data.status === 'in_progress' ? 'processing' : 'queued' };
    } catch (err) {
      if (err instanceof AppError) throw err;
      if ((err as unknown as Error).name === 'AbortError') throw new AppError('Video provider request timed out', 504, 'VIDEO_GENERATION_TIMEOUT');
      throw new AppError(`Video provider request failed: ${(err as unknown as Error).message}`, 502, 'VIDEO_GENERATION_FAILED');
    } finally {
      clearTimeout(timeout);
    }
  }

  async getJobStatus(providerJobId: string): Promise<MediaJobStatusResult> {
    if (!this.isConfigured()) throw new AppError('Media provider is not configured', 503, 'VIDEO_PROVIDER_NOT_CONFIGURED');
    const response = await fetch(`${this.baseUrl}/videos/${providerJobId}`, { headers: { Authorization: `Bearer ${this.apiKey}` } });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AppError(`Failed to fetch video job status: ${response.status}`, 502, 'VIDEO_PROVIDER_UNAVAILABLE', { body: body.slice(0, 300) });
    }
    const data = (await response.json()) as { status?: string; progress?: number; error?: { message?: string }; url?: string; output?: { url?: string } };
    return {
      providerJobId,
      status: this.mapStatus(data.status),
      progress: typeof data.progress === 'number' ? data.progress : null,
      outputUrl: data.url || data.output?.url || null,
      error: data.error?.message || null,
    };
  }

  async cancelJob(providerJobId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const response = await fetch(`${this.baseUrl}/videos/${providerJobId}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}` } });
      return response.ok;
    } catch {
      return false;
    }
  }

  private mapAspect(ratio: string): string {
    switch (ratio) {
      case '9:16': return '720x1280';
      case '1:1': return '1024x1024';
      case '4:5': return '720x900';
      default: return '1280x720';
    }
  }

  private mapStatus(status?: string): MediaJobStatusResult['status'] {
    switch ((status || '').toLowerCase()) {
      case 'queued': case 'pending': return 'queued';
      case 'in_progress': case 'processing': case 'running': return 'processing';
      case 'completed': case 'succeeded': case 'done': return 'completed';
      case 'failed': case 'error': return 'failed';
      case 'canceled': case 'cancelled': return 'canceled';
      default: return 'processing';
    }
  }
}
