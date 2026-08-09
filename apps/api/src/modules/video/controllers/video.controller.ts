import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { VideoGenerationService } from '../services/video-generation.service.js';
import { videoGenerateBodySchema, estimateCostBodySchema } from '../dto/schemas.js';
import type { ApiResponse } from '@aura/types';

export class VideoController {
  constructor(private readonly videoService: VideoGenerationService) {}

  generate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = videoGenerateBodySchema.parse(req.body);
      const data = await this.videoService.createJob(req.user!.sub, body);
      res.status(202).json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  estimate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = estimateCostBodySchema.parse(req.body);
      const data = this.videoService.estimateCost(body);
      res.status(200).json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  getJob = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jobId = req.params.jobId as string;
      const data = await this.videoService.getJob(req.user!.sub, jobId);
      res.status(200).json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jobId = req.params.jobId as string;
      const data = await this.videoService.cancelJob(req.user!.sub, jobId);
      res.status(200).json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };
}
