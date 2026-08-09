import type { MusicTrack, MusicMixConfig } from '@aura/types';
import { AppError } from '@aura/shared';

/**
 * Built-in royalty-free style catalog (metadata only).
 * Actual audio must be uploaded by workspace or provided via storage key.
 * Never claims external copyrighted tracks are available.
 */
const BUILTIN: MusicTrack[] = [
  { id: 'upbeat-1', name: 'Upbeat Energy (bring your own file)', style: 'upbeat', durationSeconds: 30, url: null, storageKey: null, isBuiltIn: true },
  { id: 'calm-1', name: 'Calm Ambient (bring your own file)', style: 'calm', durationSeconds: 30, url: null, storageKey: null, isBuiltIn: true },
  { id: 'cinematic-1', name: 'Cinematic (bring your own file)', style: 'cinematic', durationSeconds: 45, url: null, storageKey: null, isBuiltIn: true },
];

export class MusicService {
  listTracks(): MusicTrack[] {
    return BUILTIN;
  }

  resolveMix(config: MusicMixConfig | null | undefined): MusicMixConfig | null {
    if (!config) return null;
    if (!config.storageKey && !config.trackId) {
      throw new AppError(
        'Music requires an uploaded storageKey. Built-in styles are placeholders for your licensed files.',
        400,
        'MUSIC_FILE_REQUIRED',
      );
    }
    return {
      volume: config.volume ?? 0.25,
      fadeInSeconds: config.fadeInSeconds ?? 1,
      fadeOutSeconds: config.fadeOutSeconds ?? 1.5,
      duckUnderVoice: config.duckUnderVoice ?? true,
      trackId: config.trackId,
      storageKey: config.storageKey,
    };
  }
}
