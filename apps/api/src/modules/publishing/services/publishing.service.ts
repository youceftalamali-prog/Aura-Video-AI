import { eq, and, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { Database } from '../../../db/client.js';
import { socialConnections, publishingJobs, assets } from '../../../db/schema.js';
import type {
  PublishingPlatform,
  SocialConnectionPublic,
  PublishingJobPublic,
  PublishRequest,
  PublishingValidationResult,
  PublishingProviderInfo,
  PublishingJobStatus,
} from '@aura/types';
import { AppError, NotFoundError } from '@aura/shared';
import { TokenCryptoService } from './token-crypto.service.js';
import { getPublishingProvider, listPublishingProviders } from '../providers/index.js';
import { getEnv } from '@aura/config';

function log(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ level: 'info', event, ts: new Date().toISOString(), ...payload }));
}

export class PublishingService {
  private readonly crypto = new TokenCryptoService();

  constructor(private readonly db: Database) {}

  listProviders(): PublishingProviderInfo[] {
    return listPublishingProviders().map((p) => ({
      platform: p.platform,
      displayName: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      configured: p.isConfigured(),
      capabilities: p.getCapabilities(),
    }));
  }

  getCapabilities(platform: PublishingPlatform) {
    return getPublishingProvider(platform).getCapabilities();
  }

  async listConnections(workspaceId: string): Promise<SocialConnectionPublic[]> {
    const rows = await this.db
      .select()
      .from(socialConnections)
      .where(eq(socialConnections.workspaceId, workspaceId));
    return rows.map((r) => this.mapConnection(r));
  }

  startConnect(platform: PublishingPlatform): { authorizationUrl: string; state: string } {
    const provider = getPublishingProvider(platform);
    if (!provider.isConfigured()) {
      throw new AppError(`${platform} is not configured`, 503, 'PLATFORM_NOT_CONFIGURED');
    }
    const env = getEnv();
    const redirect =
      platform === 'youtube'
        ? env.YOUTUBE_REDIRECT_URI
        : platform === 'tiktok'
          ? env.TIKTOK_REDIRECT_URI
          : env.META_REDIRECT_URI;
    if (!redirect) {
      throw new AppError('OAuth redirect URI not configured', 503, 'PLATFORM_NOT_CONFIGURED');
    }
    const state = crypto.randomBytes(24).toString('hex');
    return provider.startOAuth(redirect, state);
  }

  async completeConnect(
    workspaceId: string,
    platform: PublishingPlatform,
    code: string,
  ): Promise<SocialConnectionPublic> {
    const provider = getPublishingProvider(platform);
    const env = getEnv();
    const redirect =
      platform === 'youtube'
        ? env.YOUTUBE_REDIRECT_URI!
        : platform === 'tiktok'
          ? env.TIKTOK_REDIRECT_URI!
          : env.META_REDIRECT_URI!;
    const tokens = await provider.exchangeCode(code, redirect);
    const encAccess = this.crypto.encrypt(tokens.accessToken);
    const encRefresh = tokens.refreshToken ? this.crypto.encrypt(tokens.refreshToken) : null;

    const existing = await this.db
      .select()
      .from(socialConnections)
      .where(
        and(
          eq(socialConnections.workspaceId, workspaceId),
          eq(socialConnections.platform, platform),
          eq(socialConnections.platformAccountId, tokens.platformAccountId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      const rows = await this.db
        .update(socialConnections)
        .set({
          accountName: tokens.accountName,
          accountAvatarUrl: tokens.accountAvatarUrl ?? null,
          encryptedAccessToken: encAccess,
          encryptedRefreshToken: encRefresh,
          tokenExpiresAt: tokens.expiresAt ?? null,
          scopes: tokens.scopes,
          status: 'active',
          lastValidatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(socialConnections.id, existing[0].id))
        .returning();
      log('connection_validated', { platform, connectionId: rows[0]!.id });
      return this.mapConnection(rows[0]!);
    }

    const rows = await this.db
      .insert(socialConnections)
      .values({
        workspaceId,
        platform,
        platformAccountId: tokens.platformAccountId,
        accountName: tokens.accountName,
        accountAvatarUrl: tokens.accountAvatarUrl ?? null,
        encryptedAccessToken: encAccess,
        encryptedRefreshToken: encRefresh,
        tokenExpiresAt: tokens.expiresAt ?? null,
        scopes: tokens.scopes,
        status: 'active',
        lastValidatedAt: new Date(),
      })
      .returning();
    log('connection_created', { platform, connectionId: rows[0]!.id });
    return this.mapConnection(rows[0]!);
  }

  async validateConnection(workspaceId: string, connectionId: string): Promise<SocialConnectionPublic> {
    await this.getConnection(workspaceId, connectionId);
    const rows = await this.db.select().from(socialConnections).where(eq(socialConnections.id, connectionId)).limit(1);
    const raw = rows[0]!;
    const provider = getPublishingProvider(raw.platform as unknown as PublishingPlatform);
    const token = this.crypto.decrypt(raw.encryptedAccessToken);
    const result = await provider.validateAccount(token);
    const status = result.ok ? 'active' : 'error';
    const updated = await this.db
      .update(socialConnections)
      .set({
        status,
        accountName: result.accountName || raw.accountName,
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(socialConnections.id, connectionId))
      .returning();
    log('connection_validated', { connectionId, ok: result.ok });
    return this.mapConnection(updated[0]!);
  }

  async disconnect(workspaceId: string, connectionId: string): Promise<void> {
    const rows = await this.db
      .delete(socialConnections)
      .where(and(eq(socialConnections.id, connectionId), eq(socialConnections.workspaceId, workspaceId)))
      .returning();
    if (!rows.length) throw new NotFoundError('Social connection');
  }

  async validatePublish(
    workspaceId: string,
    assetId: string,
    connectionId: string,
  ): Promise<PublishingValidationResult> {
    const errors: { code: string; message: string }[] = [];
    const warnings: { code: string; message: string }[] = [];
    const conn = await this.getConnection(workspaceId, connectionId);
    const provider = getPublishingProvider(conn.platform as unknown as PublishingPlatform);
    const caps = provider.getCapabilities();

    const assetRows = await this.db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
    const asset = assetRows[0];
    if (!asset) {
      errors.push({ code: 'ASSET_NOT_FOUND', message: 'Asset not found' });
    } else if (asset.workspaceId !== workspaceId) {
      errors.push({ code: 'ASSET_ACCESS_DENIED', message: 'Asset does not belong to workspace' });
    } else if (asset.type !== 'video' && !(asset.mimeType || '').startsWith('video/')) {
      errors.push({ code: 'ASSET_NOT_VIDEO', message: 'Asset is not a video' });
    } else if (asset.status !== 'ready') {
      errors.push({ code: 'ASSET_NOT_READY', message: 'Asset is not ready' });
    } else if (!asset.url) {
      errors.push({ code: 'ASSET_URL_MISSING', message: 'Asset has no accessible URL' });
    }

    if (conn.status !== 'active') {
      errors.push({ code: 'CONNECTION_INACTIVE', message: 'Social connection is not active' });
    }
    if (!provider.isConfigured()) {
      errors.push({ code: 'PLATFORM_NOT_CONFIGURED', message: 'Platform is not configured' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      asset: asset
        ? {
            id: asset.id,
            mimeType: asset.mimeType,
            url: asset.url,
            sizeBytes: asset.sizeBytes,
          }
        : null,
      capabilities: caps,
    };
  }

  async publishOrSchedule(workspaceId: string, _userId: string, req: PublishRequest): Promise<PublishingJobPublic> {
    // idempotency
    const existing = await this.db
      .select()
      .from(publishingJobs)
      .where(
        and(
          eq(publishingJobs.workspaceId, workspaceId),
          eq(publishingJobs.idempotencyKey, req.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing[0]) return this.mapJob(existing[0]);

    const validation = await this.validatePublish(workspaceId, req.assetId, req.connectionId);
    if (!validation.valid) {
      throw new AppError(validation.errors[0]?.message || 'Validation failed', 400, validation.errors[0]?.code || 'PUBLISH_VALIDATION_FAILED');
    }

    const conn = await this.getConnection(workspaceId, req.connectionId);
    const scheduledAt = req.scheduledAt ? new Date(req.scheduledAt) : null;
    const status: PublishingJobStatus = scheduledAt && scheduledAt > new Date() ? 'scheduled' : 'queued';

    const rows = await this.db
      .insert(publishingJobs)
      .values({
        workspaceId,
        projectId: req.projectId ?? null,
        assetId: req.assetId,
        socialConnectionId: req.connectionId,
        platform: conn.platform,
        status,
        scheduledAt,
        caption: req.caption ?? null,
        hashtags: req.hashtags ?? [],
        platformOptions: req.platformOptions ?? {},
        idempotencyKey: req.idempotencyKey,
      })
      .returning();

    const job = rows[0]!;
    log('publish_requested', { jobId: job.id, platform: conn.platform, status });

    if (status === 'queued') {
      setImmediate(() => {
        this.processJob(job.id).catch((err) => {
          console.error(JSON.stringify({ level: 'error', event: 'publish_process_failed', jobId: job.id, error: (err as unknown as Error).message }));
        });
      });
    }

    return this.mapJob(job);
  }

  async processJob(jobId: string): Promise<void> {
    const rows = await this.db.select().from(publishingJobs).where(eq(publishingJobs.id, jobId)).limit(1);
    const job = rows[0];
    if (!job) return;
    if (job.status === 'published' || job.status === 'canceled') return;

    await this.db
      .update(publishingJobs)
      .set({ status: 'validating', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(publishingJobs.id, jobId));

    try {
      const connRows = await this.db
        .select()
        .from(socialConnections)
        .where(eq(socialConnections.id, job.socialConnectionId))
        .limit(1);
      const conn = connRows[0];
      if (!conn) throw new AppError('Connection missing', 404, 'CONNECTION_NOT_FOUND');

      const assetRows = await this.db.select().from(assets).where(eq(assets.id, job.assetId)).limit(1);
      const asset = assetRows[0];
      if (!asset?.url) throw new AppError('Asset unavailable', 400, 'ASSET_URL_MISSING');

      const provider = getPublishingProvider(job.platform as unknown as PublishingPlatform);
      const accessToken = this.crypto.decrypt(conn.encryptedAccessToken);

      await this.db
        .update(publishingJobs)
        .set({ status: 'uploading', updatedAt: new Date() })
        .where(eq(publishingJobs.id, jobId));
      log('publish_started', { jobId, platform: job.platform });

      await this.db
        .update(publishingJobs)
        .set({ status: 'publishing', updatedAt: new Date() })
        .where(eq(publishingJobs.id, jobId));

      const result = await provider.publish({
        videoUrl: asset.url,
        caption: job.caption ?? undefined,
        hashtags: (job.hashtags as string[]) || [],
        platformOptions: (job.platformOptions as unknown as Record<string, unknown>) || {},
        accessToken,
      });

      await this.db
        .update(publishingJobs)
        .set({
          status: 'published',
          externalPostId: result.externalPostId,
          externalPostUrl: result.externalPostUrl,
          completedAt: new Date(),
          updatedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        })
        .where(eq(publishingJobs.id, jobId));
      log('publish_completed', { jobId, externalPostId: result.externalPostId });
    } catch (err) {
      const code = err instanceof AppError ? err.code : 'PUBLISH_FAILED';
      const message = err instanceof AppError ? err.message : (err as unknown as Error).message;
      await this.db
        .update(publishingJobs)
        .set({
          status: 'failed',
          errorCode: code,
          errorMessage: message,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(publishingJobs.id, jobId));
      log('publish_failed', { jobId, errorCode: code });
    }
  }

  async listJobs(workspaceId: string, limit = 50): Promise<PublishingJobPublic[]> {
    const rows = await this.db
      .select()
      .from(publishingJobs)
      .where(eq(publishingJobs.workspaceId, workspaceId))
      .orderBy(desc(publishingJobs.createdAt))
      .limit(limit);
    return rows.map((r) => this.mapJob(r));
  }

  async getJob(workspaceId: string, jobId: string): Promise<PublishingJobPublic> {
    const rows = await this.db
      .select()
      .from(publishingJobs)
      .where(and(eq(publishingJobs.id, jobId), eq(publishingJobs.workspaceId, workspaceId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundError('Publishing job');
    return this.mapJob(rows[0]);
  }

  async retryJob(workspaceId: string, jobId: string): Promise<PublishingJobPublic> {
    const job = await this.getJob(workspaceId, jobId);
    if (job.status !== 'failed') {
      throw new AppError('Only failed jobs can be retried', 400, 'JOB_NOT_RETRYABLE');
    }
    const permanent = ['PLATFORM_NOT_CONFIGURED', 'ASSET_NOT_VIDEO', 'CONNECTION_INACTIVE', 'PUBLISH_REQUIRES_PAGE_CONTEXT', 'PUBLISH_REQUIRES_IG_BUSINESS'];
    if (job.errorCode && permanent.includes(job.errorCode)) {
      throw new AppError('This error is not retryable', 400, 'JOB_NOT_RETRYABLE');
    }
    await this.db
      .update(publishingJobs)
      .set({
        status: 'queued',
        retryCount: job.retryCount + 1,
        errorCode: null,
        errorMessage: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(publishingJobs.id, jobId));
    log('publish_retry', { jobId });
    setImmediate(() => {
      this.processJob(jobId).catch(() => undefined);
    });
    return this.getJob(workspaceId, jobId);
  }

  async cancelJob(workspaceId: string, jobId: string): Promise<PublishingJobPublic> {
    const job = await this.getJob(workspaceId, jobId);
    if (!['queued', 'scheduled'].includes(job.status)) {
      throw new AppError('Job cannot be canceled', 400, 'JOB_NOT_CANCELLABLE');
    }
    await this.db
      .update(publishingJobs)
      .set({ status: 'canceled', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(publishingJobs.id, jobId));
    log('publish_canceled', { jobId });
    return this.getJob(workspaceId, jobId);
  }

  /** Process due scheduled jobs (call from worker/cron). */
  async processDueScheduled(): Promise<void> {
    const now = new Date();
    const rows = await this.db.select().from(publishingJobs).where(eq(publishingJobs.status, 'scheduled'));
    for (const job of rows) {
      if (job.scheduledAt && job.scheduledAt <= now) {
        await this.db
          .update(publishingJobs)
          .set({ status: 'queued', updatedAt: new Date() })
          .where(eq(publishingJobs.id, job.id));
        setImmediate(() => this.processJob(job.id).catch(() => undefined));
      }
    }
  }

  private async getConnection(workspaceId: string, connectionId: string) {
    const rows = await this.db
      .select()
      .from(socialConnections)
      .where(and(eq(socialConnections.id, connectionId), eq(socialConnections.workspaceId, workspaceId)))
      .limit(1);
    if (!rows[0]) throw new NotFoundError('Social connection');
    return rows[0];
  }

  private mapConnection(row: Record<string, unknown>): SocialConnectionPublic {
    return {
      id: String(row.id),
      workspaceId: String(row.workspaceId),
      platform: row.platform as unknown as PublishingPlatform,
      platformAccountId: String(row.platformAccountId),
      accountName: String(row.accountName),
      accountAvatarUrl: (row.accountAvatarUrl as string) ?? null,
      scopes: (row.scopes as string[]) || [],
      status: row.status as unknown as SocialConnectionPublic['status'],
      lastValidatedAt: row.lastValidatedAt ? new Date(row.lastValidatedAt as unknown as Date).toISOString() : null,
      createdAt: new Date(row.createdAt as unknown as Date).toISOString(),
      updatedAt: new Date(row.updatedAt as unknown as Date).toISOString(),
    };
  }

  private mapJob(row: Record<string, unknown>): PublishingJobPublic {
    return {
      id: String(row.id),
      workspaceId: String(row.workspaceId),
      projectId: (row.projectId as string) ?? null,
      assetId: String(row.assetId),
      socialConnectionId: String(row.socialConnectionId),
      platform: row.platform as unknown as PublishingPlatform,
      status: row.status as unknown as PublishingJobStatus,
      scheduledAt: row.scheduledAt ? new Date(row.scheduledAt as unknown as Date).toISOString() : null,
      startedAt: row.startedAt ? new Date(row.startedAt as unknown as Date).toISOString() : null,
      completedAt: row.completedAt ? new Date(row.completedAt as unknown as Date).toISOString() : null,
      externalPostId: (row.externalPostId as string) ?? null,
      externalPostUrl: (row.externalPostUrl as string) ?? null,
      caption: (row.caption as string) ?? null,
      hashtags: (row.hashtags as string[]) || [],
      platformOptions: (row.platformOptions as unknown as Record<string, unknown>) || {},
      errorCode: (row.errorCode as string) ?? null,
      errorMessage: (row.errorMessage as string) ?? null,
      retryCount: Number(row.retryCount ?? 0),
      createdAt: new Date(row.createdAt as unknown as Date).toISOString(),
      updatedAt: new Date(row.updatedAt as unknown as Date).toISOString(),
    };
  }
}
