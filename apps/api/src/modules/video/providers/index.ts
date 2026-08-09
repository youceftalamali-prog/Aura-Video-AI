import { getEnv } from '@aura/config';
import type {
  MediaGenerateVideoParams,
  MediaJobStatusResult,
  MediaProviderCapabilities,
  MediaProviderName,
  VideoGenerationMode,
} from '@aura/types';
import type { IMediaGenerationProvider, MediaSubmitResult } from '../interfaces/media-provider.interface.js';
import { OpenAIMediaProvider } from './openai-media.provider.js';
import { AppError } from '@aura/shared';

/**
 * Media provider registry.
 * - openai → OpenAIMediaProvider (real implementation)
 * - none → DisabledMediaProvider (API boots; generate → VIDEO_PROVIDER_DISABLED)
 * - fal|runway|kling|veo|google|other → VIDEO_PROVIDER_NOT_IMPLEMENTED (never silent OpenAI fallback)
 */
let provider: IMediaGenerationProvider | null = null;

const IMPLEMENTED = new Set<string>(['openai']);

class DisabledMediaProvider implements IMediaGenerationProvider {
  readonly name: MediaProviderName = 'none';

  capabilities(): MediaProviderCapabilities {
    return { textToVideo: false, imageToVideo: false, asyncJobs: false, cancel: false };
  }

  isConfigured(): boolean {
    return false;
  }

  supportsMode(_mode: VideoGenerationMode): boolean {
    return false;
  }

  async generateVideo(_params: MediaGenerateVideoParams): Promise<MediaSubmitResult> {
    throw new AppError(
      'Media provider is disabled. Set MEDIA_PROVIDER=openai and MEDIA_API_KEY to enable video generation.',
      503,
      'VIDEO_PROVIDER_DISABLED',
    );
  }

  async getJobStatus(_providerJobId: string): Promise<MediaJobStatusResult> {
    throw new AppError('Media provider is disabled', 503, 'VIDEO_PROVIDER_DISABLED');
  }

  async cancelJob(_providerJobId: string): Promise<boolean> {
    return false;
  }
}

export function getMediaProvider(): IMediaGenerationProvider {
  if (!provider) {
    const env = getEnv();
    const name = String(env.MEDIA_PROVIDER || 'none').toLowerCase();

    if (name === 'none' || name === '') {
      provider = new DisabledMediaProvider();
      return provider;
    }

    if (name === 'openai') {
      provider = new OpenAIMediaProvider();
      return provider;
    }

    throw new AppError(
      `Video provider "${name}" is not implemented. Implemented providers: openai. Use MEDIA_PROVIDER=openai or MEDIA_PROVIDER=none.`,
      501,
      'VIDEO_PROVIDER_NOT_IMPLEMENTED',
    );
  }
  return provider;
}

export function requireConfiguredMediaProvider(): IMediaGenerationProvider {
  const p = getMediaProvider();
  if (!p.isConfigured()) {
    throw new AppError(
      'Media provider is not configured. Set MEDIA_PROVIDER=openai and MEDIA_API_KEY.',
      503,
      'VIDEO_PROVIDER_NOT_CONFIGURED',
    );
  }
  return p;
}

export function resetMediaProvider(): void {
  provider = null;
}

export function listImplementedMediaProviders(): string[] {
  return Array.from(IMPLEMENTED);
}

export { OpenAIMediaProvider } from './openai-media.provider.js';
