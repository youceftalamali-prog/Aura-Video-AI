import { eq, and } from 'drizzle-orm';
import type { Database } from '../../../db/client.js';
import { videoGenerationJobs } from '../../../db/schema.js';
import type { MediaProviderName, VideoJobStatus, VideoGenerationJob } from '@aura/types';

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
    return rows[0] ? this.map(rows[0]) : null;
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
