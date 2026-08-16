import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { ProductService } from '../services/product.service.js';
import {
  importUrlSchema,
  importTextSchema,
  importImageSchema,
  refreshIntelligenceSchema,
  createVideoFromProductSchema,
} from '../dto/schemas.js';
import type { ApiResponse } from '@aura/types';
import { NotFoundError } from '@aura/shared';
import { WorkspaceRepository } from '../../../domain/repositories/workspace.repository.js';
import type { Database } from '../../../db/client.js';

export class ProductsController {
  private readonly workspaces: WorkspaceRepository;

  constructor(
    private readonly products: ProductService,
    db: Database,
  ) {
    this.workspaces = new WorkspaceRepository(db);
  }

  private async workspaceId(userId: string): Promise<string> {
    const ws = await this.workspaces.findPersonalByOwnerId(userId);
    if (!ws) throw new NotFoundError('Workspace');
    return ws.id;
  }

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.products.list(req.user!.sub);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  get = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.products.get(req.user!.sub, req.params.id as string);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  remove = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.products.delete(req.user!.sub, req.params.id as string);
      res.json({ success: true, data: { deleted: true } } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  importUrl = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = importUrlSchema.parse(req.body);
      const workspaceId = await this.workspaceId(req.user!.sub);
      const data = await this.products.importUrl(req.user!.sub, workspaceId, body.url, body.strategy);
      res.status(201).json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  importText = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = importTextSchema.parse(req.body);
      const workspaceId = await this.workspaceId(req.user!.sub);
      const data = await this.products.importText(req.user!.sub, workspaceId, body);
      res.status(201).json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  importImage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = importImageSchema.parse(req.body);
      const workspaceId = await this.workspaceId(req.user!.sub);
      const data = await this.products.importImage(req.user!.sub, workspaceId, body);
      res.status(201).json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  intelligence = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.products.getIntelligence(req.user!.sub, req.params.id as string);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  refreshIntelligence = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = refreshIntelligenceSchema.parse(req.body ?? {});
      const data = await this.products.refreshIntelligence(req.user!.sub, req.params.id as string, body.strategy);
      res.status(200).json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  hooks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = refreshIntelligenceSchema.parse(req.body ?? {});
      const data = await this.products.generateHooks(req.user!.sub, req.params.id as string, body.strategy);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  createVideo = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = createVideoFromProductSchema.parse({
        ...req.body,
        productId: req.params.id || req.body.productId,
      });
      const data = await this.products.createVideoWorkflow(req.user!.sub, body);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };
}
