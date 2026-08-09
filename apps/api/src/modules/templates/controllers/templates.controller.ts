import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { TemplateLibraryService } from '../services/template-library.service.js';
import { listTemplatesQuerySchema, instantiateBodySchema, generateBodySchema, customizeBodySchema } from '../dto/schemas.js';
import type { ApiResponse } from '@aura/types';

export class TemplatesController {
  constructor(private readonly library: TemplateLibraryService) {}

  listCategories = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.library.listCategories();
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const q = listTemplatesQuerySchema.parse(req.query);
      const data = await this.library.listTemplates(q);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  byCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const category = req.params.category as string;
      const data = await this.library.listTemplates({ category });
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  get = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.library.getByIdOrSlug(req.params.id as string);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  instantiate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = instantiateBodySchema.parse(req.body);
      const data = await this.library.instantiate(req.user!.sub, req.params.id as string, body.productId);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  generate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = generateBodySchema.parse(req.body);
      const data = await this.library.generate(req.user!.sub, req.params.id as string, body.productId, {
        aspectRatio: body.aspectRatio,
        duration: body.duration,
      });
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  preview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = customizeBodySchema.parse(req.body);
      const data = await this.library.buildPreviewConfig(req.user!.sub, req.params.id as string, body);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  customize = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = customizeBodySchema.parse(req.body);
      const data = await this.library.customizeAndInstantiate(req.user!.sub, req.params.id as string, body);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  generateCustom = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = customizeBodySchema.parse(req.body);
      const data = await this.library.generateWithCustomization(req.user!.sub, req.params.id as string, body);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };
}
