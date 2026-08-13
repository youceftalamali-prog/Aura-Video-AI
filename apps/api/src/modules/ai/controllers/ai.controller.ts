import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { ProductAnalysisService } from '../services/product-analysis.service.js';
import type { AIAssistantService } from '../services/assistant.service.js';
import type { AIGateway } from '../gateway/ai-gateway.js';
import {
  analyzeProductTextBodySchema,
  analyzeProductUrlBodySchema,
  analyzeProductImageBodySchema,
  aiAssistantBodySchema,
} from '../dto/schemas.js';
import type { ApiResponse } from '@aura/types';

export class AIController {
  constructor(
    private readonly productAnalysis: ProductAnalysisService,
    private readonly assistantService: AIAssistantService,
    private readonly gateway: AIGateway,
  ) {}

  analyzeProductText = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = analyzeProductTextBodySchema.parse(req.body);
      const analysis = await this.productAnalysis.analyzeFromText(body);
      res.status(200).json({ success: true, data: analysis } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  analyzeProductUrl = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = analyzeProductUrlBodySchema.parse(req.body);
      const result = await this.productAnalysis.analyzeFromUrl(body.url);
      res.status(200).json({
        success: true,
        data: {
          analysis: result.analysis,
          metadata: result.metadata,
        },
      } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  analyzeProductImage = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = analyzeProductImageBodySchema.parse(req.body);
      const analysis = await this.productAnalysis.analyzeFromImage(body);
      res.status(200).json({ success: true, data: analysis } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  assistant = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = aiAssistantBodySchema.parse(req.body);
      const result = await this.assistantService.process(body);
      res.status(200).json({ success: true, data: result } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  listModels = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const models = await this.gateway.listModels();
      const safe = models.map((model) => ({
        id: model.id,
        displayName: model.displayName ?? model.id,
        providerId: model.provider,
        capabilities: model.capabilities,
        contextLength: model.contextWindow ?? null,
        pricing:
          model.promptPrice !== undefined || model.completionPrice !== undefined
            ? { prompt: model.promptPrice ?? null, completion: model.completionPrice ?? null }
            : null,
      }));
      res.status(200).json({ success: true, data: safe } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };
}
