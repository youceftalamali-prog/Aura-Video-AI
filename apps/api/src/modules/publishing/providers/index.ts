import type { PublishingPlatform } from '@aura/types';
import type { IPublishingProvider } from '../interfaces/publishing-provider.interface.js';
import { YouTubePublishingProvider } from './youtube.provider.js';
import { FacebookPublishingProvider, InstagramPublishingProvider } from './meta.provider.js';
import { TikTokPublishingProvider } from './tiktok.provider.js';
import { AppError } from '@aura/shared';

const registry: Record<PublishingPlatform, IPublishingProvider> = {
  youtube: new YouTubePublishingProvider(),
  facebook: new FacebookPublishingProvider(),
  instagram: new InstagramPublishingProvider(),
  tiktok: new TikTokPublishingProvider(),
};

export function getPublishingProvider(platform: PublishingPlatform): IPublishingProvider {
  const p = registry[platform];
  if (!p) throw new AppError(`Unknown platform: ${platform}`, 400, 'INVALID_PLATFORM');
  return p;
}

export function listPublishingProviders(): IPublishingProvider[] {
  return Object.values(registry);
}
