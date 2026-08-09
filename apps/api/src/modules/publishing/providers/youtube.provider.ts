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

export class YouTubePublishingProvider implements IPublishingProvider {
  readonly platform: PublishingPlatform = 'youtube';

  getCapabilities(): PublishingCapabilities {
    return {
      publishNow: true,
      scheduling: false,
      videoUpload: true,
      caption: false,
      hashtags: false,
      thumbnail: true,
      privacyControls: true,
      comments: true,
      title: true,
      description: true,
    };
  }

  isConfigured(): boolean {
    const e = getEnv();
    return Boolean(e.YOUTUBE_CLIENT_ID && e.YOUTUBE_CLIENT_SECRET);
  }

  startOAuth(redirectUri: string, state: string): OAuthStartResult {
    if (!this.isConfigured()) {
      throw new AppError('YouTube is not configured', 503, 'PLATFORM_NOT_CONFIGURED');
    }
    const e = getEnv();
    const params = new URLSearchParams({
      client_id: e.YOUTUBE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return {
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      state,
    };
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResult> {
    if (!this.isConfigured()) {
      throw new AppError('YouTube is not configured', 503, 'PLATFORM_NOT_CONFIGURED');
    }
    const e = getEnv();
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: e.YOUTUBE_CLIENT_ID!,
        client_secret: e.YOUTUBE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!res.ok) {
      throw new AppError('YouTube token exchange failed', 502, 'OAUTH_TOKEN_EXCHANGE_FAILED');
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    const profile = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${data.access_token}` } },
    );
    if (!profile.ok) {
      throw new AppError('Failed to load YouTube channel', 502, 'OAUTH_ACCOUNT_FETCH_FAILED');
    }
    const ch = (await profile.json()) as {
      items?: Array<{ id: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }>;
    };
    const item = ch.items?.[0];
    if (!item) {
      throw new AppError('No YouTube channel found for account', 400, 'OAUTH_ACCOUNT_FETCH_FAILED');
    }
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: (data.scope || '').split(' ').filter(Boolean),
      platformAccountId: item.id,
      accountName: item.snippet?.title || 'YouTube Channel',
      accountAvatarUrl: item.snippet?.thumbnails?.default?.url ?? null,
    };
  }

  async validateAccount(accessToken: string): Promise<{ ok: boolean; accountName?: string }> {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return { ok: false };
    const ch = (await res.json()) as { items?: Array<{ snippet?: { title?: string } }> };
    return { ok: true, accountName: ch.items?.[0]?.snippet?.title };
  }

  async publish(input: PublishMediaInput): Promise<PublishResult> {
    // Real upload requires resumable upload protocol to YouTube Data API.
    // Without configured credentials this path is never reached.
    if (!this.isConfigured()) {
      throw new AppError('YouTube is not configured', 503, 'PLATFORM_NOT_CONFIGURED');
    }
    const opts = (input.platformOptions || {}) as { title?: string; description?: string; privacy?: string };
    const title = opts.title || input.caption?.slice(0, 100) || 'Aura Video AI Upload';
    const description = opts.description || input.caption || '';
    const privacy = opts.privacy || 'private';

    // Initiate resumable upload session
    const session = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
        },
        body: JSON.stringify({
          snippet: { title, description, tags: input.hashtags || [] },
          status: { privacyStatus: privacy },
        }),
      },
    );
    if (!session.ok) {
      const body = await session.text().catch(() => '');
      throw new AppError('YouTube upload session failed', 502, 'PUBLISH_PROVIDER_ERROR', {
        status: session.status,
        body: body.slice(0, 300),
      });
    }
    const uploadUrl = session.headers.get('location');
    if (!uploadUrl) {
      throw new AppError('YouTube did not return upload URL', 502, 'PUBLISH_PROVIDER_ERROR');
    }

    const media = await fetch(input.videoUrl);
    if (!media.ok) {
      throw new AppError('Failed to fetch video for upload', 502, 'PUBLISH_MEDIA_UNAVAILABLE');
    }
    const buf = Buffer.from(await media.arrayBuffer());
    const uploaded = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'video/mp4',
        'Content-Length': String(buf.length),
      },
      body: buf,
    });
    if (!uploaded.ok) {
      throw new AppError('YouTube video upload failed', 502, 'PUBLISH_PROVIDER_ERROR');
    }
    const result = (await uploaded.json()) as { id?: string };
    if (!result.id) {
      throw new AppError('YouTube returned no video id', 502, 'PUBLISH_PROVIDER_ERROR');
    }
    return {
      externalPostId: result.id,
      externalPostUrl: `https://www.youtube.com/watch?v=${result.id}`,
    };
  }
}
