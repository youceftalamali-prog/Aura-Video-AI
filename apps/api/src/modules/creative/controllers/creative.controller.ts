import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { CreativeStrategyService } from '../services/creative-strategy.service.js';
import type { AdScriptService } from '../services/ad-script.service.js';
import type { StoryboardService } from '../services/storyboard.service.js';
import type { TemplateService } from '../services/template.service.js';
import {
  generateStrategyBodySchema,
  generateScriptBodySchema,
  generateStoryboardBodySchema,
  recommendTemplateBodySchema,
} from '../dto/schemas.js';
import type { ApiResponse } from '@aura/types';

export class CreativeController {
  constructor(
    private readonly strategyService: CreativeStrategyService,
    private readonly scriptService: AdScriptService,
    private readonly storyboardService: StoryboardService,
    private readonly templateService: TemplateService,
  ) {}

  generateStrategy = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = generateStrategyBodySchema.parse(req.body);
      const data = await this.strategyService.generate(body);
      res.status(200).json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  generateScript = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = generateScriptBodySchema.parse(req.body);
      const data = await this.scriptService.generate(body);
      res.status(200).json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  generateStoryboard = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = generateStoryboardBodySchema.parse(req.body);
      const data = await this.storyboardService.generate(body);
      res.status(200).json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  listTemplates = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.templateService.listActive();
      res.status(200).json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  getTemplate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params.id as string;
      const data = await this.templateService.getByIdOrThrow(id);
      res.status(200).json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  recommendTemplate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = recommendTemplateBodySchema.parse(req.body);
      const all = await this.templateService.listActive();
      const data = this.templateService.recommend(
        body.productAnalysis,
        body.creativeStrategy,
        all,
        body.limit,
      );
      res.status(200).json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };
}
