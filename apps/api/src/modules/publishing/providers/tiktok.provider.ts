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

export class TikTokPublishingProvider implements IPublishingProvider {
  readonly platform: PublishingPlatform = 'tiktok';

  getCapabilities(): PublishingCapabilities {
    return {
      publishNow: true,
      scheduling: false,
      videoUpload: true,
      caption: true,
      hashtags: true,
      thumbnail: false,
      privacyControls: true,
      comments: true,
      title: false,
      description: false,
    };
  }

  isConfigured(): boolean {
    const e = getEnv();
    return Boolean(e.TIKTOK_CLIENT_KEY && e.TIKTOK_CLIENT_SECRET);
  }

  startOAuth(redirectUri: string, state: string): OAuthStartResult {
    if (!this.isConfigured()) {
      throw new AppError('TikTok is not configured', 503, 'PLATFORM_NOT_CONFIGURED');
    }
    const e = getEnv();
    const params = new URLSearchParams({
      client_key: e.TIKTOK_CLIENT_KEY!,
      scope: 'user.info.basic,video.upload,video.publish',
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    });
    return {
      authorizationUrl: `https://www.tiktok.com/v2/auth/authorize/?${params}`,
      state,
    };
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    if (!this.isConfigured()) {
      throw new AppError('TikTok is not configured', 503, 'PLATFORM_NOT_CONFIGURED');
    }
    const e = getEnv();
    const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: e.TIKTOK_CLIENT_KEY!,
        client_secret: e.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      throw new AppError('TikTok token exchange failed', 502, 'OAUTH_TOKEN_EXCHANGE_FAILED');
    }
    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      open_id?: string;
      scope?: string;
      error?: string;
    };
    if (!data.access_token || !data.open_id) {
      throw new AppError('TikTok token response incomplete', 502, 'OAUTH_TOKEN_EXCHANGE_FAILED');
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: (data.scope || '').split(',').filter(Boolean),
      platformAccountId: data.open_id,
      accountName: 'TikTok Account',
      accountAvatarUrl: null,
    };
  }

  async validateAccount(accessToken: string): Promise<{ ok: boolean; accountName?: string }> {
    const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { data?: { user?: { display_name?: string } } };
    return { ok: true, accountName: data.data?.user?.display_name };
  }

  async publish(input: PublishMediaInput): Promise<PublishResult> {
    if (!this.isConfigured()) {
      throw new AppError('TikTok is not configured', 503, 'PLATFORM_NOT_CONFIGURED');
    }
    // TikTok Content Posting API is multi-step (init → upload → publish).
    // Implement init; full binary upload follows official docs when app is approved.
    const init = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        post_info: {
          title: (input.caption || 'Aura Video').slice(0, 150),
          privacy_level: 'SELF_ONLY',
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: input.videoUrl,
        },
      }),
    });
    if (!init.ok) {
      const body = await init.text().catch(() => '');
      throw new AppError('TikTok publish init failed', 502, 'PUBLISH_PROVIDER_ERROR', {
        status: init.status,
        body: body.slice(0, 300),
      });
    }
    const data = (await init.json()) as { data?: { publish_id?: string } };
    if (!data.data?.publish_id) {
      throw new AppError('TikTok did not return publish_id', 502, 'PUBLISH_PROVIDER_ERROR');
    }
    return {
      externalPostId: data.data.publish_id,
      externalPostUrl: null,
    };
  }
}
