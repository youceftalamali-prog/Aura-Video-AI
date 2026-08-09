import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';
import type { PublishingCapabilities, PublishingPlatform } from '@aura/types';
import type {
  IPublishingProvider,
  OAuthStartResult,
  OAuthTokenResult,
  PublishMediaInput,
  PublishResult,
} from '../interfaces/publishing-provider.interface.js';

/** Shared Meta (Facebook/Instagram) OAuth base. Platform-specific publish differs. */
abstract class MetaBaseProvider implements IPublishingProvider {
  abstract readonly platform: PublishingPlatform;
  abstract getCapabilities(): PublishingCapabilities;

  isConfigured(): boolean {
    const e = getEnv();
    return Boolean(e.META_CLIENT_ID && e.META_CLIENT_SECRET);
  }

  startOAuth(redirectUri: string, state: string): OAuthStartResult {
    if (!this.isConfigured()) {
      throw new AppError('Meta platforms are not configured', 503, 'PLATFORM_NOT_CONFIGURED');
    }
    const e = getEnv();
    const scopes =
      this.platform === 'instagram'
        ? 'instagram_basic,instagram_content_publish,pages_show_list'
        : 'pages_manage_posts,pages_read_engagement,pages_show_list';
    const params = new URLSearchParams({
      client_id: e.META_CLIENT_ID!,
      redirect_uri: redirectUri,
      state,
      scope: scopes,
      response_type: 'code',
    });
    return {
      authorizationUrl: `https://www.facebook.com/v19.0/dialog/oauth?${params}`,
      state,
    };
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    if (!this.isConfigured()) {
      throw new AppError('Meta platforms are not configured', 503, 'PLATFORM_NOT_CONFIGURED');
    }
    const e = getEnv();
    const res = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          client_id: e.META_CLIENT_ID!,
          client_secret: e.META_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          code,
        }),
    );
    if (!res.ok) {
      throw new AppError('Meta token exchange failed', 502, 'OAUTH_TOKEN_EXCHANGE_FAILED');
    }
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    const me = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name,picture&access_token=${encodeURIComponent(data.access_token)}`,
    );
    if (!me.ok) {
      throw new AppError('Failed to load Meta account', 502, 'OAUTH_ACCOUNT_FETCH_FAILED');
    }
    const profile = (await me.json()) as {
      id: string;
      name?: string;
      picture?: { data?: { url?: string } };
    };
    return {
      accessToken: data.access_token,
      refreshToken: null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: [],
      platformAccountId: profile.id,
      accountName: profile.name || 'Meta Account',
      accountAvatarUrl: profile.picture?.data?.url ?? null,
    };
  }

  async validateAccount(accessToken: string): Promise<{ ok: boolean; accountName?: string }> {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { name?: string };
    return { ok: true, accountName: data.name };
  }

  abstract publish(_input: PublishMediaInput): Promise<PublishResult>;
}

export class FacebookPublishingProvider extends MetaBaseProvider {
  readonly platform: PublishingPlatform = 'facebook';

  getCapabilities(): PublishingCapabilities {
    return {
      publishNow: true,
      scheduling: true,
      videoUpload: true,
      caption: true,
      hashtags: true,
      thumbnail: false,
      privacyControls: false,
      comments: true,
      title: false,
      description: true,
    };
  }

  async publish(_input: PublishMediaInput): Promise<PublishResult> {
    if (!this.isConfigured()) {
      throw new AppError('Facebook is not configured', 503, 'PLATFORM_NOT_CONFIGURED');
    }
    // Publishing video to a Page requires page access token + page id in connection metadata.
    // Without a page context we return a clear capability/config error rather than faking success.
    throw new AppError(
      'Facebook page video publish requires a connected Page with publish permissions. Complete Page selection after OAuth.',
      400,
      'PUBLISH_REQUIRES_PAGE_CONTEXT',
    );
  }
}

export class InstagramPublishingProvider extends MetaBaseProvider {
  readonly platform: PublishingPlatform = 'instagram';

  getCapabilities(): PublishingCapabilities {
    return {
      publishNow: true,
      scheduling: false,
      videoUpload: true,
      caption: true,
      hashtags: true,
      thumbnail: false,
      privacyControls: false,
      comments: true,
      title: false,
      description: false,
    };
  }

  async publish(_input: PublishMediaInput): Promise<PublishResult> {
    if (!this.isConfigured()) {
      throw new AppError('Instagram is not configured', 503, 'PLATFORM_NOT_CONFIGURED');
    }
    throw new AppError(
      'Instagram Reels publish requires an Instagram Business account linked to a Page. Complete IG account selection after OAuth.',
      400,
      'PUBLISH_REQUIRES_IG_BUSINESS',
    );
  }
}
