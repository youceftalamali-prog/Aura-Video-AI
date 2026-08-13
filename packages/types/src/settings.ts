import type { UUID, ISODateString } from './common';
import type { PublicUser } from './user';

export type AiStrategy = 'fast' | 'balanced' | 'smart';

export type AppearancePreference = 'light' | 'dark' | 'system';

export type AspectRatioPreference = '16:9' | '9:16' | '1:1' | '4:5';

export type ResolutionPreference = '720p' | '1080p' | '4k';

export interface NotificationPreferences {
  emailAlerts: boolean;
  marketing: boolean;
  agentUpdates: boolean;
  billing: boolean;
}

export interface UserPreferences {
  language: string | null;
  appearance: AppearancePreference | null;
  defaultAiModel: string | null;
  aiStrategy: AiStrategy | null;
  defaultVideoDuration: number | null;
  defaultAspectRatio: AspectRatioPreference | null;
  defaultResolution: ResolutionPreference | null;
  defaultVideoLanguage: string | null;
  notifications: NotificationPreferences;
}

export type MutableUserPreferenceKeys =
  | 'language'
  | 'appearance'
  | 'defaultAiModel'
  | 'aiStrategy'
  | 'defaultVideoDuration'
  | 'defaultAspectRatio'
  | 'defaultResolution'
  | 'defaultVideoLanguage'
  | 'notifications';

export type UpdateUserPreferencesInput = Partial<Pick<UserPreferences, MutableUserPreferenceKeys>>;

export interface WorkspaceSettings {
  workspaceId: UUID;
  defaultAiModel: string | null;
  aiStrategy: AiStrategy | null;
}

export type UpdateWorkspaceSettingsInput = Partial<Pick<WorkspaceSettings, 'defaultAiModel' | 'aiStrategy'>>;

export interface ResolvedAiSettings {
  model: string | null;
  strategy: AiStrategy;
}

export interface ResolvedVideoDefaults {
  defaultDuration: number;
  defaultAspectRatio: AspectRatioPreference;
  defaultResolution: ResolutionPreference;
  language: string;
}

export interface ResolvedSettings {
  language: string;
  appearance: AppearancePreference;
  ai: ResolvedAiSettings;
  video: ResolvedVideoDefaults;
  notifications: NotificationPreferences;
}

export interface WorkspaceRef {
  id: UUID;
  name: string;
  slug: string;
  ownerId: UUID;
}

export interface UserSettingsPayload {
  profile: PublicUser;
  preferences: UserPreferences;
  resolved: ResolvedSettings;
  workspace: WorkspaceRef | null;
  updatedAt?: ISODateString;
}

/** Safe model listing returned by GET /api/v1/ai/models (no secrets). */
export interface AiModelOption {
  id: string;
  displayName: string;
  providerId: string;
  capabilities: string[];
  contextLength: number | null;
  pricing: { prompt: number | null; completion: number | null } | null;
}

export interface WorkspaceSettingsPayload {
  workspace: WorkspaceRef;
  settings: WorkspaceSettings;
  resolved: ResolvedSettings;
  updatedAt?: ISODateString;
}

/** Key names in the system (KV) settings table consulted by SettingsResolver. */
export const SYSTEM_SETTING_KEYS = {
  defaultAiModel: 'ai.default_model',
  defaultAiStrategy: 'ai.strategy',
  defaultLanguage: 'app.default_language',
  defaultVideoDuration: 'app.default_video_duration',
  defaultAspectRatio: 'app.default_aspect_ratio',
} as const;

/** Feature flag keys stored in the KV settings table (prefix `flags.`). */
export const FEATURE_FLAG_PREFIX = 'flags.';

export const FEATURE_FLAG_KEY_PATTERN = /^flags\.[a-z0-9][a-z0-9_.-]{1,79}$/;