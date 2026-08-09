import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { LibraryService } from '../services/library.service.js';
import { createProjectBodySchema, updateProjectBodySchema } from '../dto/schemas.js';
import type { ApiResponse } from '@aura/types';
import { z } from 'zod';

export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  listProjects = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.library.listProjects(req.user!.sub);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  getProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.library.getProject(req.user!.sub, req.params.id as string);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  createProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = createProjectBodySchema.parse(req.body);
      const data = await this.library.createProject(req.user!.sub, body);
      res.status(201).json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  updateProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = updateProjectBodySchema.parse(req.body);
      const data = await this.library.updateProject(req.user!.sub, req.params.id as string, body);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  deleteProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.library.deleteProject(req.user!.sub, req.params.id as string);
      res.json({ success: true, data: { deleted: true } } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  listAssets = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const type = req.query.type ? z.string().max(20).parse(req.query.type) : undefined;
      const data = await this.library.listAssets(req.user!.sub, type);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  getAsset = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.library.getAsset(req.user!.sub, req.params.id as string);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  exportAsset = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.library.exportAsset(req.user!.sub, req.params.id as string);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };
}
