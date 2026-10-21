import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { getEnv } from '@aura/config';
import { AppError, NotFoundError, AuthorizationError } from '@aura/shared';
import type {
  CreateVideoJobResult,
  VideoCostEstimate,
  VideoGenerationJobPublic,
  VideoGenerationMode,
  VideoGenerationRequest,
  VideoJobStatus,
} from '@aura/types';
import type { Database } from '../../../db/client.js';
import { projects, workspaces, assets } from '../../../db/schema.js';
import { VideoJobRepository } from './video-job.repository.js';
import type { IMediaGenerationProvider } from '../interfaces/media-provider.interface.js';
import { getStorageProvider } from '../../../infrastructure/storage/index.js';
import { CreditLedgerService } from './credit-ledger.service.js';
import { StudioRenderService } from '../../studio/services/studio-render.service.js';
import { assertSafeRemoteUrl } from '../../../infrastructure/security/url-safety.js';
import { getRedis } from '../../../infrastructure/redis/client.js';

function logEvent(event: string, payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: 'info', event, ts: new Date().toISOString(), ...payload }));
}

const ACTIVE: VideoJobStatus[] = ['queued', 'processing', 'composing', 'rendering'];
const DEFAULT_LEASE_OWNER = `inline:${process.pid}`;

export class VideoGenerationService {
  private readonly credits: CreditLedgerService;
  private readonly renderer: StudioRenderService;

  constructor(
    private readonly db: Database,
    private readonly jobs: VideoJobRepository,
    private readonly media: IMediaGenerationProvider,
  ) {
    this.credits = new CreditLedgerService(db);
    this.renderer = new StudioRenderService();
  }

  estimateCost(request: Pick<VideoGenerationRequest, 'duration' | 'scenes' | 'mode' | 'sourceImageUrl'>): VideoCostEstimate {
    const mode: VideoGenerationMode =
      request.mode ?? (request.sourceImageUrl ? 'image_to_video' : request.scenes.length > 1 ? 'storyboard' : 'text_to_video');
    const canRenderLocally = ['storyboard', 'image_to_video'].includes(mode) &&
      Boolean(request.sourceImageUrl || request.scenes.some((scene) => scene.imageUrl)) &&
      !this.media.isConfigured();
    return this.credits.estimateCost({
      duration: request.duration,
      sceneCount: request.scenes.length,
      mode: canRenderLocally ? 'storyboard' : mode,
    });
  }

  async createJob(userId: string, request: VideoGenerationRequest): Promise<CreateVideoJobResult> {
    const env = getEnv();
    if (request.duration > env.VIDEO_MAX_DURATION) {
      throw new AppError(`Duration exceeds maximum of ${env.VIDEO_MAX_DURATION}s`, 400, 'INVALID_VIDEO_INPUT');
    }
    if (request.scenes.length > env.VIDEO_MAX_SCENES) {
      throw new AppError(`Too many scenes (max ${env.VIDEO_MAX_SCENES})`, 400, 'INVALID_VIDEO_INPUT');
    }

    const project = await this.getProjectForUser(request.projectId, userId);
    const mode: VideoGenerationMode =
      request.mode ?? (request.sourceImageUrl ? 'image_to_video' : request.scenes.length > 1 ? 'storyboard' : 'text_to_video');

    const canRenderLocally = ['storyboard', 'image_to_video'].includes(mode) && Boolean(request.sourceImageUrl || request.scenes.some((scene) => scene.imageUrl));
    if (!this.media.isConfigured() && !canRenderLocally) {
      throw new AppError('Configure a video provider, or use storyboard mode with product images for local rendering.', 503, 'VIDEO_PROVIDER_NOT_CONFIGURED');
    }
    if (this.media.isConfigured() && !this.media.supportsMode(mode)) {
      throw new AppError(`Provider does not support mode: ${mode}`, 400, 'INVALID_VIDEO_INPUT');
    }

    if (request.idempotencyKey) {
      const existing = await this.jobs.findByIdempotency(project.workspaceId, request.idempotencyKey);
      if (existing) {
        return { jobId: existing.id, status: existing.status, creditsCharged: existing.creditsCharged };
      }
    }

    const estimate = this.credits.estimateCost({ duration: request.duration, sceneCount: request.scenes.length, mode: canRenderLocally ? 'storyboard' : mode });
    const chargeReference = request.idempotencyKey ? `request:${request.idempotencyKey}` : randomUUID();
    const chargeIdempotencyKey = `video:charge:${project.workspaceId}:${chargeReference}`;
    await this.credits.deduct(project.workspaceId, estimate.credits, {
      userId,
      description: 'Video generation charge',
      referenceType: 'video_generation',
      referenceId: chargeReference,
      idempotencyKey: chargeIdempotencyKey,
    });

    const prompt = request.scenes.map((s) => s.visualPrompt).join('\n---\n');
    let job;
    try {
      job = await this.jobs.create({
        workspaceId: project.workspaceId,
        projectId: project.id,
        userId,
        provider: this.media.isConfigured() ? this.media.name : 'none',
        status: 'queued',
        currentStage: 'queued',
        prompt,
        creditsCharged: estimate.credits,
        idempotencyKey: request.idempotencyKey ?? null,
        input: {
          aspectRatio: request.aspectRatio,
          duration: request.duration,
          scenes: request.scenes,
          templateId: request.templateId ?? null,
          mode,
          sourceImageUrl: request.sourceImageUrl ?? null,
          voiceUrl: request.voiceUrl ?? null,
          style: request.style ?? null,
        },
      });
    } catch (err) {
      if (request.idempotencyKey) {
        const existing = await this.jobs.findByIdempotency(project.workspaceId, request.idempotencyKey);
        if (existing) {
          return { jobId: existing.id, status: existing.status, creditsCharged: existing.creditsCharged };
        }
      }
      await this.credits.refund(project.workspaceId, estimate.credits, {
        userId,
        description: 'Refund for failed video job creation',
        referenceType: 'video_generation_refund',
        referenceId: chargeReference,
        idempotencyKey: `video:refund:create:${chargeReference}`,
      });
      throw err;
    }

    logEvent('generation_requested', { jobId: job.id, projectId: project.id, userId, mode, credits: estimate.credits });

    setImmediate(() => {
      this.processJob(job.id).catch((err) => {
        console.error(JSON.stringify({ level: 'error', event: 'background_process_failed', jobId: job.id, error: (err as unknown as Error).message }));
      });
    });

    try {
      const redis = getRedis();
      await redis.lpush('aura:video:jobs', job.id);
    } catch {
      // Redis optional for queue fan-out; the database worker can recover queued jobs
    }

    return { jobId: job.id, status: 'queued', creditsCharged: estimate.credits };
  }

  async processJob(jobId: string, leaseOwner = DEFAULT_LEASE_OWNER): Promise<void> {
    const job = await this.jobs.claimQueued(jobId, leaseOwner);
    if (!job) return;

    const input = job.input as {
      aspectRatio: VideoGenerationRequest['aspectRatio'];
      duration: number;
      scenes: VideoGenerationRequest['scenes'];
      mode: VideoGenerationMode;
      sourceImageUrl?: string;
      voiceUrl?: string;
      style?: string;
    };

    try {
      if (!this.media.isConfigured()) {
        await this.jobs.update(jobId, { status: 'rendering', currentStage: 'rendering', progress: 20 });
        const downloaded: string[] = [];
        let localResult: { localPath: string; mimeType: string } | null = null;
        try {
          const scenes = [];
          for (const scene of input.scenes) {
            const imageUrl = scene.imageUrl || input.sourceImageUrl;
            if (!imageUrl) throw new AppError('Each storyboard scene needs a product image URL for local rendering.', 400, 'INVALID_VIDEO_INPUT');
            const imagePath = await this.downloadRemoteAssetToTemp(imageUrl, 'image');
            downloaded.push(imagePath);
            scenes.push({ order: scene.order, duration: scene.duration, imagePath, onScreenText: scene.onScreenText });
          }
          let voicePath: string | null = null;
          if (input.voiceUrl) {
            voicePath = await this.downloadRemoteAssetToTemp(input.voiceUrl, 'audio');
            downloaded.push(voicePath);
          }
          localResult = await this.renderer.render({ scenes, aspectRatio: input.aspectRatio, voicePath });
          await this.jobs.update(jobId, { status: 'rendering', currentStage: 'saving_asset', progress: 85 });
          const assetId = await this.persistLocalVideo(job, localResult.localPath, { durationSeconds: input.duration, resolution: input.aspectRatio });
          await this.jobs.update(jobId, { status: 'completed', currentStage: 'completed', progress: 100, assetId, completedAt: new Date() });
          logEvent('local_storyboard_completed', { jobId, assetId, scenes: scenes.length, hasVoiceover: Boolean(voicePath) });
          return;
        } finally {
          for (const file of downloaded) await fs.unlink(file).catch(() => undefined);
          if (localResult?.localPath) await fs.unlink(localResult.localPath).catch(() => undefined);
        }
      }
      const prompt = job.prompt || input.scenes.map((s) => s.visualPrompt).join('\n');
      const submitted = await this.media.generateVideo({
        prompt,
        aspectRatio: input.aspectRatio,
        duration: input.duration,
        scenes: input.scenes,
        mode: input.mode,
        sourceImageUrl: input.sourceImageUrl,
        style: input.style,
        metadata: { jobId },
      });

      await this.jobs.update(jobId, {
        providerJobId: submitted.providerJobId,
        status: 'processing',
        currentStage: 'provider_processing',
        progress: 15,
      });
      logEvent('generation_submitted', { jobId, providerJobId: submitted.providerJobId, leaseOwner });

      const maxAttempts = 60;
      let remoteUrl: string | null = null;
      for (let i = 0; i < maxAttempts; i++) {
        await sleep(5000);
        if (!(await this.jobs.heartbeat(jobId, leaseOwner))) {
          logEvent('generation_lease_lost', { jobId, leaseOwner });
          return;
        }

        const current = await this.jobs.findById(jobId);
        if (!current || current.status === 'canceled') return;

        const remote = await this.media.getJobStatus(submitted.providerJobId);
        const progress = remote.progress ?? Math.min(70, 15 + i * 2);
        await this.jobs.update(jobId, {
          status: remote.status === 'completed' ? 'composing' : remote.status === 'failed' ? 'failed' : 'processing',
          progress,
          currentStage: remote.status === 'completed' ? 'composing' : 'provider_processing',
          error: remote.error,
        });

        if (remote.status === 'failed') {
          await this.failAndRefund(jobId, job.workspaceId, job.creditsCharged, remote.error || 'Provider failed', job.userId);
          return;
        }
        if (remote.status === 'canceled') {
          await this.jobs.update(jobId, { status: 'canceled', completedAt: new Date() });
          await this.credits.refund(job.workspaceId, job.creditsCharged, {
            userId: job.userId,
            description: 'Refund for canceled video generation',
            referenceType: 'video_generation_refund',
            referenceId: jobId,
            idempotencyKey: `video:refund:${jobId}`,
          });
          return;
        }
        if (remote.status === 'completed' && remote.outputUrl) {
          remoteUrl = remote.outputUrl;
          break;
        }
      }

      if (!remoteUrl) {
        await this.failAndRefund(jobId, job.workspaceId, job.creditsCharged, 'Video generation timed out', job.userId);
        throw new AppError('Video generation timed out', 504, 'VIDEO_GENERATION_TIMEOUT');
      }

      if (!(await this.jobs.heartbeat(jobId, leaseOwner))) {
        logEvent('generation_lease_lost_before_composition', { jobId, leaseOwner });
        return;
      }
      await this.jobs.update(jobId, { status: 'composing', currentStage: 'composing', progress: 75 });
      logEvent('generation_processing', { jobId, stage: 'composing' });

      const localProviderPath = await this.downloadToTemp(remoteUrl);
      await this.jobs.update(jobId, { status: 'rendering', currentStage: 'rendering', progress: 85 });

      let voicePath: string | null = null;
      let composed: { localPath: string; mimeType: string } | null = null;
      try {
        if (input.voiceUrl) voicePath = await this.downloadRemoteAssetToTemp(input.voiceUrl, 'audio');
        composed = await this.renderer.render({
          aspectRatio: input.aspectRatio,
          scenes: [{ order: 1, duration: input.duration, videoPath: localProviderPath }],
          voicePath,
        });
      } finally {
        if (voicePath) await fs.unlink(voicePath).catch(() => undefined);
      }
      if (!composed) throw new AppError('Final render was not created', 500, 'VIDEO_GENERATION_FAILED');

      const assetId = await this.persistLocalVideo(job, composed.localPath, {
        durationSeconds: input.duration,
        resolution: input.aspectRatio,
      });

      await this.jobs.update(jobId, {
        status: 'completed',
        currentStage: 'completed',
        progress: 100,
        assetId,
        completedAt: new Date(),
      });

      await fs.unlink(localProviderPath).catch(() => undefined);
      await fs.unlink(composed.localPath).catch(() => undefined);

      logEvent('generation_completed', { jobId, assetId, leaseOwner });
    } catch (err) {
      const message = err instanceof AppError ? err.message : (err as unknown as Error).message;
      await this.failAndRefund(jobId, job.workspaceId, job.creditsCharged, message, job.userId);
      logEvent('generation_failed', { jobId, error: message });
    }
  }

  async getJob(userId: string, jobId: string): Promise<VideoGenerationJobPublic> {
    const job = await this.jobs.findByIdForUser(jobId, userId);
    if (!job) throw new AppError('Video job not found', 404, 'VIDEO_JOB_NOT_FOUND');

    // Never return an expired URL when an asset is available. Resolve a fresh
    // server-signed URL, while keeping ownership scoped to the requesting user.
    if (job.assetId) {
      const rows = await this.db
        .select({ storageKey: assets.storageKey, status: assets.status })
        .from(assets)
        .where(and(eq(assets.id, job.assetId), eq(assets.userId, userId)))
        .limit(1);
      const asset = rows[0];
      if (asset?.status === 'ready') {
        const storage = getStorageProvider();
        if (await storage.exists(asset.storageKey)) {
          job.outputUrl = await storage.getSignedUrl(asset.storageKey, 3600);
        } else {
          job.outputUrl = null;
        }
      } else {
        job.outputUrl = null;
      }
    }
    return this.toPublic(job);
  }

  async cancelJob(userId: string, jobId: string): Promise<VideoGenerationJobPublic> {
    const job = await this.jobs.findByIdForUser(jobId, userId);
    if (!job) throw new AppError('Video job not found', 404, 'VIDEO_JOB_NOT_FOUND');
    if (['completed', 'failed', 'canceled'].includes(job.status)) {
      throw new AppError('Job cannot be canceled in its current state', 400, 'VIDEO_JOB_NOT_CANCELLABLE');
    }
    if (job.providerJobId && this.media.cancelJob) {
      await this.media.cancelJob(job.providerJobId);
    }
    if (job.creditsCharged > 0 && ACTIVE.includes(job.status)) {
      await this.credits.refund(job.workspaceId, job.creditsCharged, {
        userId,
        description: 'Refund for canceled video generation',
        referenceType: 'video_generation_refund',
        referenceId: job.id,
        idempotencyKey: `video:refund:${job.id}`,
      });
    }
    const updated = await this.jobs.update(job.id, { status: 'canceled', currentStage: 'canceled', completedAt: new Date() });
    logEvent('generation_canceled', { jobId: job.id, userId });
    return this.toPublic(updated ?? job);
  }

  private async failAndRefund(jobId: string, workspaceId: string, credits: number, error: string, userId?: string): Promise<void> {
    await this.jobs.update(jobId, { status: 'failed', currentStage: 'failed', error, completedAt: new Date() });
    if (credits > 0) {
      await this.credits.refund(workspaceId, credits, {
        userId: userId ?? null,
        description: 'Refund for failed video generation',
        referenceType: 'video_generation_refund',
        referenceId: jobId,
        idempotencyKey: `video:refund:${jobId}`,
      });
    }
  }

  private async downloadRemoteAssetToTemp(url: string, kind: 'image' | 'audio'): Promise<string> {
    const parsed = await assertSafeRemoteUrl(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(parsed.toString(), { method: 'GET', redirect: 'manual', signal: controller.signal });
      if (response.status >= 300 && response.status < 400) {
        throw new AppError('Remote media redirects are blocked for security.', 400, 'REMOTE_ASSET_REDIRECT_BLOCKED');
      }
      if (!response.ok || !response.body) throw new AppError('Could not download media asset.', 400, 'REMOTE_ASSET_DOWNLOAD_FAILED');
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (kind === 'image' && !contentType.startsWith('image/')) throw new AppError('Storyboard URL did not return an image.', 400, 'INVALID_STORYBOARD_IMAGE');
      if (kind === 'audio' && !contentType.startsWith('audio/')) throw new AppError('Voiceover URL did not return audio.', 400, 'INVALID_VOICEOVER_AUDIO');
      const maxBytes = kind === 'image' ? 12 * 1024 * 1024 : 30 * 1024 * 1024;
      if (Number(response.headers.get('content-length') || 0) > maxBytes) throw new AppError('Media asset is too large.', 413, 'REMOTE_ASSET_TOO_LARGE');
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let total = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          const chunk = Buffer.from(part.value);
          total += chunk.length;
          if (total > maxBytes) {
            await reader.cancel();
            throw new AppError('Media asset is too large.', 413, 'REMOTE_ASSET_TOO_LARGE');
          }
          chunks.push(chunk);
        }
      } finally {
        reader.releaseLock();
      }
      if (!total) throw new AppError('Media asset is empty.', 400, 'REMOTE_ASSET_INVALID');
      const target = `/tmp/aura-${kind}-${randomUUID()}.${kind === 'image' ? 'img' : 'mp3'}`;
      await fs.writeFile(target, Buffer.concat(chunks, total));
      return target;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if ((err as Error).name === 'AbortError') throw new AppError('Media asset download timed out.', 408, 'REMOTE_ASSET_TIMEOUT');
      throw new AppError('Could not download media asset.', 400, 'REMOTE_ASSET_DOWNLOAD_FAILED');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async downloadToTemp(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new AppError('Failed to download provider output', 502, 'VIDEO_OUTPUT_INVALID');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) throw new AppError('Provider output is invalid', 502, 'VIDEO_OUTPUT_INVALID');
    const path = `/tmp/aura-provider-${Date.now()}.mp4`;
    await fs.writeFile(path, buf);
    return path;
  }

  private async persistLocalVideo(
    job: { id: string; workspaceId: string; userId: string; projectId: string },
    localPath: string,
    metadata: { durationSeconds?: number; resolution?: string },
  ): Promise<string> {
    try {
      const storage = getStorageProvider();
      const key = `videos/${job.workspaceId}/${job.id}.mp4`;
      const buf = await fs.readFile(localPath);
      const uploaded = await storage.upload({
        key,
        body: buf,
        contentType: 'video/mp4',
        metadata: { jobId: job.id, projectId: job.projectId },
      });
      const rows = await this.db
        .insert(assets)
        .values({
          workspaceId: job.workspaceId,
          userId: job.userId,
          name: `video-${job.id}`,
          type: 'video',
          mimeType: 'video/mp4',
          sizeBytes: buf.length,
          storageKey: key,
          url: uploaded.url,
          status: 'ready',
          metadata: { jobId: job.id, projectId: job.projectId, source: 'video_generation' },
        })
        .returning();
      const asset = rows[0];
      if (!asset) throw new AppError('Video asset could not be persisted', 500, 'VIDEO_STORAGE_FAILED');

      const projectRows = await this.db
        .update(projects)
        .set({
          videoAssetId: asset.id,
          videoUrl: null,
          status: 'completed',
          durationSeconds: metadata.durationSeconds ?? null,
          resolution: metadata.resolution ?? null,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(projects.id, job.projectId), eq(projects.workspaceId, job.workspaceId)))
        .returning({ id: projects.id });
      if (!projectRows[0]) throw new AppError('Project video link could not be persisted', 500, 'VIDEO_PROJECT_LINK_FAILED');

      await this.jobs.update(job.id, { outputUrl: null, assetId: asset.id });
      return asset.id;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Video storage failed: ${(err as unknown as Error).message}`, 500, 'VIDEO_STORAGE_FAILED');
    }
  }

  private async getProjectForUser(projectId: string, userId: string) {
    const rows = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    const project = rows[0];
    if (!project) throw new NotFoundError('Project');
    if (project.userId === userId) return project;
    const ws = await this.db.select().from(workspaces).where(eq(workspaces.id, project.workspaceId)).limit(1);
    if (ws[0]?.ownerId === userId) return project;
    throw new AuthorizationError('Project access denied');
  }

  private toPublic(job: {
    id: string;
    status: string;
    progress: number | null;
    currentStage?: string | null;
    provider: string;
    outputUrl: string | null;
    assetId: string | null;
    error: string | null;
    projectId: string;
    creditsCharged?: number;
    createdAt: string | Date;
    updatedAt: string | Date;
    completedAt: string | Date | null;
  }): VideoGenerationJobPublic {
    return {
      id: job.id,
      status: job.status as unknown as VideoGenerationJobPublic['status'],
      progress: job.progress,
      currentStage: job.currentStage ?? null,
      provider: job.provider as unknown as VideoGenerationJobPublic['provider'],
      outputUrl: job.outputUrl,
      assetId: job.assetId,
      error: job.error,
      projectId: job.projectId,
      creditsCharged: job.creditsCharged ?? 0,
      createdAt: new Date(job.createdAt).toISOString(),
      updatedAt: new Date(job.updatedAt).toISOString(),
      completedAt: job.completedAt ? new Date(job.completedAt).toISOString() : null,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
