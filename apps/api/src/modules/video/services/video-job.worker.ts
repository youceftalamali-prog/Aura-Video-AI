import { randomUUID } from 'node:crypto';
import { getRedis } from '../../../infrastructure/redis/client.js';
import type { VideoGenerationService } from './video-generation.service.js';
import type { VideoJobRepository } from './video-job.repository.js';

const QUEUE_KEY = 'aura:video:jobs';
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 20;

export class VideoJobWorker {
  private readonly workerId = `worker:${process.pid}:${randomUUID()}`;
  private readonly activeRuns = new Map<string, Promise<void>>();
  private timer: NodeJS.Timeout | null = null;
  private tickInFlight = false;
  private running = false;

  constructor(
    private readonly jobs: VideoJobRepository,
    private readonly service: VideoGenerationService,
    private readonly redis = getRedis(),
  ) {}

  async start(pollIntervalMs = DEFAULT_POLL_INTERVAL_MS): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, pollIntervalMs);
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await Promise.allSettled(this.activeRuns.values());
  }

  private async tick(): Promise<void> {
    if (!this.running || this.tickInFlight) return;
    this.tickInFlight = true;
    try {
      try {
        const recovered = await this.jobs.requeueExpiredLeases(BATCH_SIZE);
        recovered.forEach((jobId) => this.dispatch(jobId));
      } catch (error) {
        console.error(JSON.stringify({
          level: 'error',
          event: 'video_worker_recovery_failed',
          error: (error as Error).message,
        }));
      }

      try {
        for (let index = 0; index < BATCH_SIZE; index += 1) {
          const jobId = await this.redis.lpop(QUEUE_KEY);
          if (!jobId) break;
          this.dispatch(jobId);
        }
      } catch (error) {
        // The database scan below keeps queued work recoverable when Redis is
        // unavailable; Redis is an accelerator, not the source of truth.
        console.error(JSON.stringify({
          level: 'warn',
          event: 'video_worker_redis_poll_failed',
          error: (error as Error).message,
        }));
      }

      try {
        const queued = await this.jobs.listQueuedIds(BATCH_SIZE);
        queued.forEach((jobId) => this.dispatch(jobId));
      } catch (error) {
        console.error(JSON.stringify({
          level: 'error',
          event: 'video_worker_database_scan_failed',
          error: (error as Error).message,
        }));
      }
    } finally {
      this.tickInFlight = false;
    }
  }

  private dispatch(jobId: string): void {
    if (this.activeRuns.has(jobId)) return;
    const run = this.service
      .processJob(jobId, this.workerId)
      .catch((error) => {
        console.error(JSON.stringify({
          level: 'error',
          event: 'video_worker_job_failed',
          jobId,
          error: (error as Error).message,
        }));
      });
    this.activeRuns.set(jobId, run);
    void run.finally(() => this.activeRuns.delete(jobId));
  }
}

export { BATCH_SIZE, DEFAULT_POLL_INTERVAL_MS, QUEUE_KEY };
