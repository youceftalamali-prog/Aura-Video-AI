import type {
  PublishingCapabilities,
  PublishingPlatform,
  PlatformOptions,
} from '@aura/types';

export interface OAuthStartResult {
  authorizationUrl: string;
  state: string;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scopes: string[];
  platformAccountId: string;
  accountName: string;
  accountAvatarUrl?: string | null;
}

export interface PublishMediaInput {
  videoUrl: string;
  caption?: string;
  hashtags?: string[];
  platformOptions?: PlatformOptions;
  accessToken: string;
}

export interface PublishResult {
  externalPostId: string;
  externalPostUrl: string | null;
}

export interface ProviderStatusResult {
  status: 'published' | 'processing' | 'failed';
  externalPostUrl?: string | null;
  error?: string | null;
}

export interface IPublishingProvider {
  readonly platform: PublishingPlatform;
  getCapabilities(): PublishingCapabilities;
  isConfigured(): boolean;
  startOAuth(redirectUri: string, state: string): OAuthStartResult;
  exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<OAuthTokenResult>;
  refreshAccessToken?(refreshToken: string): Promise<OAuthTokenResult>;
  validateAccount(accessToken: string): Promise<{ ok: boolean; accountName?: string }>;
  publish(input: PublishMediaInput): Promise<PublishResult>;
  getStatus?(accessToken: string, externalPostId: string): Promise<ProviderStatusResult>;
  cancel?(): Promise<boolean>;
}
