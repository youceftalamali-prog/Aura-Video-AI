import type { UUID, ISODateString } from './common';

export type PublishingPlatform = 'youtube' | 'instagram' | 'facebook' | 'tiktok';

export type SocialConnectionStatus = 'active' | 'expired' | 'revoked' | 'error';

export type PublishingJobStatus =
  | 'queued'
  | 'scheduled'
  | 'validating'
  | 'uploading'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'canceled';

export interface PublishingCapabilities {
  publishNow: boolean;
  scheduling: boolean;
  videoUpload: boolean;
  caption: boolean;
  hashtags: boolean;
  thumbnail: boolean;
  privacyControls: boolean;
  comments: boolean;
  title: boolean;
  description: boolean;
}

export interface SocialConnectionPublic {
  id: UUID;
  workspaceId: UUID;
  platform: PublishingPlatform;
  platformAccountId: string;
  accountName: string;
  accountAvatarUrl: string | null;
  scopes: string[];
  status: SocialConnectionStatus;
  lastValidatedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PlatformOptionsYouTube {
  title?: string;
  description?: string;
  tags?: string[];
  privacy?: 'public' | 'unlisted' | 'private';
}

export interface PlatformOptionsMeta {
  caption?: string;
  message?: string;
  hashtags?: string[];
}

export interface PlatformOptionsTikTok {
  caption?: string;
  hashtags?: string[];
}

export type PlatformOptions = PlatformOptionsYouTube | PlatformOptionsMeta | PlatformOptionsTikTok | Record<string, unknown>;

export interface PublishRequest {
  assetId: UUID;
  connectionId: UUID;
  caption?: string;
  hashtags?: string[];
  platformOptions?: PlatformOptions;
  scheduledAt?: ISODateString;
  idempotencyKey: string;
  projectId?: UUID;
}

export interface PublishingValidationResult {
  valid: boolean;
  errors: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  asset: {
    id: UUID;
    mimeType: string | null;
    url: string | null;
    sizeBytes: number | null;
  } | null;
  capabilities: PublishingCapabilities;
}

export interface PublishingJobPublic {
  id: UUID;
  workspaceId: UUID;
  projectId: UUID | null;
  assetId: UUID;
  socialConnectionId: UUID;
  platform: PublishingPlatform;
  status: PublishingJobStatus;
  scheduledAt: ISODateString | null;
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
  externalPostId: string | null;
  externalPostUrl: string | null;
  caption: string | null;
  hashtags: string[];
  platformOptions: PlatformOptions;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PublishingProviderInfo {
  platform: PublishingPlatform;
  displayName: string;
  configured: boolean;
  capabilities: PublishingCapabilities;
}
