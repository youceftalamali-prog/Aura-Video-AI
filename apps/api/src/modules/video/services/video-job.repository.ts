import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { videoGenerationJobs } from '../../../db/schema.js';
import type { MediaProviderName, VideoJobStatus, VideoGenerationJob } from '@aura/types';

const DEFAULT_LEASE_SECONDS = 900;
const ACTIVE_STATUSES: VideoJobStatus[] = ['processing', 'composing', 'rendering'];

export class VideoJobRepository {
  constructor(private readonly db: Database) {}

  async create(data: {
    workspaceId: string;
    projectId: string;
    userId: string;
    provider: MediaProviderName;
    providerJobId?: string | null;
    status?: VideoJobStatus;
    currentStage?: string | null;
    prompt?: string | null;
    input: Record<string, unknown>;
    creditsCharged?: number;
    idempotencyKey?: string | null;
  }): Promise<VideoGenerationJob> {
    const rows = await this.db
      .insert(videoGenerationJobs)
      .values({
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        userId: data.userId,
        provider: data.provider,
        providerJobId: data.providerJobId ?? null,
        status: data.status ?? 'queued',
        currentStage: data.currentStage ?? 'queued',
        prompt: data.prompt ?? null,
        input: data.input,
        creditsCharged: data.creditsCharged ?? 0,
        idempotencyKey: data.idempotencyKey ?? null,
      })
      .returning();
    return this.map(rows[0]!);
  }

  /** Atomically claims a queued job and assigns a renewable worker lease. */
  async claimQueued(
    id: string,
    leaseOwner = `inline:${process.pid}`,
    leaseSeconds = DEFAULT_LEASE_SECONDS,
  ): Promise<VideoGenerationJob | null> {
    const result = await this.db.execute(sql`
      UPDATE video_generation_jobs
      SET
        status = 'processing',
        current_stage = 'provider_submit',
        progress = 5,
        lease_owner = ${leaseOwner},
        lease_expires_at = NOW() + (${leaseSeconds} * INTERVAL '1 second'),
        attempt_count = COALESCE(attempt_count, 0) + 1,
        last_heartbeat_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}
        AND status = 'queued'
      RETURNING id
    `);
    if (!this.rows<{ id: string }>(result)[0]) return null;
    return this.findById(id);
  }

  /** Extends a lease only for the worker that currently owns it. */
  async heartbeat(id: string, leaseOwner: string, leaseSeconds = DEFAULT_LEASE_SECONDS): Promise<boolean> {
    const result = await this.db.execute(sql`
      UPDATE video_generation_jobs
      SET
        lease_expires_at = NOW() + (${leaseSeconds} * INTERVAL '1 second'),
        last_heartbeat_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}
        AND lease_owner = ${leaseOwner}
        AND status IN ('processing', 'composing', 'rendering')
        AND lease_expires_at > NOW()
      RETURNING id
    `);
    return Boolean(this.rows<{ id: string }>(result)[0]);
  }

  /** Requeues only jobs that never reached an external provider. */
  async requeueExpiredLeases(limit = 20): Promise<string[]> {
    const result = await this.db.execute(sql`
      WITH expired AS (
        SELECT id
        FROM video_generation_jobs
        WHERE status = 'processing'
          AND provider_job_id IS NULL
          AND lease_expires_at IS NOT NULL
          AND lease_expires_at < NOW()
        ORDER BY lease_expires_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE video_generation_jobs AS jobs
      SET
        status = 'queued',
        current_stage = 'queued',
        progress = NULL,
        lease_owner = NULL,
        lease_expires_at = NULL,
        last_heartbeat_at = NOW(),
        error = 'Recovered after worker lease expiry',
        updated_at = NOW()
      FROM expired
      WHERE jobs.id = expired.id
      RETURNING jobs.id
    `);
    return this.rows<{ id: string }>(result).map((row) => String(row.id));
  }

  async listQueuedIds(limit = 20): Promise<string[]> {
    const rows = await this.db
      .select({ id: videoGenerationJobs.id })
      .from(videoGenerationJobs)
      .where(eq(videoGenerationJobs.status, 'queued'))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async findByIdempotency(workspaceId: string, key: string): Promise<VideoGenerationJob | null> {
    const rows = await this.db
      .select()
      .from(videoGenerationJobs)
      .where(and(eq(videoGenerationJobs.workspaceId, workspaceId), eq(videoGenerationJobs.idempotencyKey, key)))
      .limit(1);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async findById(id: string): Promise<VideoGenerationJob | null> {
    const rows = await this.db.select().from(videoGenerationJobs).where(eq(videoGenerationJobs.id, id)).limit(1);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<VideoGenerationJob | null> {
    const rows = await this.db
      .select()
      .from(videoGenerationJobs)
      .where(and(eq(videoGenerationJobs.id, id), eq(videoGenerationJobs.userId, userId)))
      .limit(1);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async update(
    id: string,
    patch: Partial<{
      status: VideoJobStatus;
      progress: number | null;
      currentStage: string | null;
      providerJobId: string | null;
      outputUrl: string | null;
      assetId: string | null;
      error: string | null;
      creditsCharged: number;
      completedAt: Date | null;
    }>,
  ): Promise<VideoGenerationJob | null> {
    const rows = await this.db
      .update(videoGenerationJobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(videoGenerationJobs.id, id))
      .returning();
    const updated = rows[0] ? this.map(rows[0]) : null;
    if (updated && patch.status && ['completed', 'failed', 'canceled'].includes(patch.status)) {
      await this.db.execute(sql`
        UPDATE video_generation_jobs
        SET lease_owner = NULL, lease_expires_at = NULL, last_heartbeat_at = NOW()
        WHERE id = ${id}
      `);
    }
    return updated;
  }

  private rows<T>(result: unknown): T[] {
    if (Array.isArray(result)) return result as T[];
    if (result && typeof result === 'object' && 'rows' in result) {
      const rows = (result as { rows?: unknown }).rows;
      return Array.isArray(rows) ? (rows as T[]) : [];
    }
    return [];
  }

  private map(row: Record<string, unknown>): VideoGenerationJob {
    return {
      id: String(row.id),
      workspaceId: String(row.workspaceId),
      projectId: String(row.projectId),
      userId: String(row.userId),
      provider: row.provider as unknown as VideoGenerationJob['provider'],
      providerJobId: (row.providerJobId as string) ?? null,
      status: row.status as unknown as VideoGenerationJob['status'],
      progress: (row.progress as number) ?? null,
      currentStage: (row.currentStage as string) ?? null,
      prompt: (row.prompt as string) ?? null,
      input: (row.input as unknown as Record<string, unknown>) ?? {},
      outputUrl: (row.outputUrl as string) ?? null,
      assetId: (row.assetId as string) ?? null,
      error: (row.error as string) ?? null,
      creditsCharged: Number(row.creditsCharged ?? 0),
      idempotencyKey: (row.idempotencyKey as string) ?? null,
      createdAt: new Date(row.createdAt as unknown as Date).toISOString(),
      updatedAt: new Date(row.updatedAt as unknown as Date).toISOString(),
      completedAt: row.completedAt ? new Date(row.completedAt as unknown as Date).toISOString() : null,
    };
  }
}

export { ACTIVE_STATUSES, DEFAULT_LEASE_SECONDS };
