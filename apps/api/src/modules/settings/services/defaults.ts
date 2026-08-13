import type { AiStrategy } from '@aura/types';

export const DEFAULT_NOTIFICATIONS = {
  emailAlerts: true,
  marketing: false,
  agentUpdates: true,
  billing: true,
} as const;

export const DEFAULT_STRATEGY: AiStrategy = 'balanced';
export const DEFAULT_LANGUAGE = 'en';
export const DEFAULT_APPEARANCE = 'system';
export const DEFAULT_VIDEO_DURATION = 30;
export const DEFAULT_ASPECT_RATIO = '9:16';
export const DEFAULT_RESOLUTION = '1080p';

export const DEFAULT_PREFERENCES = {
  language: null,
  appearance: null,
  defaultAiModel: null,
  aiStrategy: null,
  defaultVideoDuration: null,
  defaultAspectRatio: null,
  defaultResolution: null,
  defaultVideoLanguage: null,
  notifications: DEFAULT_NOTIFICATIONS,
} as const;
