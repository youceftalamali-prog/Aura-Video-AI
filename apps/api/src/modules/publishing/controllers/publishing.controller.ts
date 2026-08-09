import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { PublishingService } from '../services/publishing.service.js';
import { platformSchema, connectCallbackSchema, validatePublishSchema, publishSchema } from '../dto/schemas.js';
import type { ApiResponse, PublishingPlatform } from '@aura/types';
import { WorkspaceRepository } from '../../../domain/repositories/workspace.repository.js';
import type { Database } from '../../../db/client.js';

export class PublishingController {
  private readonly workspaces: WorkspaceRepository;

  constructor(
    private readonly publishing: PublishingService,
    db: Database,
  ) {
    this.workspaces = new WorkspaceRepository(db);
  }

  private async ws(userId: string): Promise<string> {
    const w = await this.workspaces.findPersonalByOwnerId(userId);
    if (!w) throw new Error('Workspace not found');
    return w.id;
  }

  listProviders = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ success: true, data: this.publishing.listProviders() } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  capabilities = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const platform = platformSchema.parse(req.params.platform);
      res.json({ success: true, data: this.publishing.getCapabilities(platform) } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  listConnections = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = await this.ws(req.user!.sub);
      const data = await this.publishing.listConnections(workspaceId);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  startConnect = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const platform = platformSchema.parse(req.params.platform);
      const data = this.publishing.startConnect(platform);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  completeConnect = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const platform = platformSchema.parse(req.params.platform);
      const body = connectCallbackSchema.parse(req.body);
      const workspaceId = await this.ws(req.user!.sub);
      const data = await this.publishing.completeConnect(workspaceId, platform as unknown as PublishingPlatform, body.code);
      res.status(201).json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  validateConnection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = await this.ws(req.user!.sub);
      const data = await this.publishing.validateConnection(workspaceId, req.params.id as string);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  disconnect = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = await this.ws(req.user!.sub);
      await this.publishing.disconnect(workspaceId, req.params.id as string);
      res.json({ success: true, data: { disconnected: true } } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  validate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = validatePublishSchema.parse(req.body);
      const workspaceId = await this.ws(req.user!.sub);
      const data = await this.publishing.validatePublish(workspaceId, body.assetId, body.connectionId);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  publish = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = publishSchema.parse(req.body);
      const workspaceId = await this.ws(req.user!.sub);
      const data = await this.publishing.publishOrSchedule(workspaceId, req.user!.sub, body);
      res.status(202).json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  schedule = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = publishSchema.parse(req.body);
      if (!body.scheduledAt) {
        res.status(400).json({ success: false, error: { code: 'SCHEDULED_AT_REQUIRED', message: 'scheduledAt is required' } });
        return;
      }
      const workspaceId = await this.ws(req.user!.sub);
      const data = await this.publishing.publishOrSchedule(workspaceId, req.user!.sub, body);
      res.status(202).json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  listJobs = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = await this.ws(req.user!.sub);
      const data = await this.publishing.listJobs(workspaceId);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  getJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = await this.ws(req.user!.sub);
      const data = await this.publishing.getJob(workspaceId, req.params.id as string);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  retry = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = await this.ws(req.user!.sub);
      const data = await this.publishing.retryJob(workspaceId, req.params.id as string);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  cancel = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = await this.ws(req.user!.sub);
      const data = await this.publishing.cancelJob(workspaceId, req.params.id as string);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };
}
