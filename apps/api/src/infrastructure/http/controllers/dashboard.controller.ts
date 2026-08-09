import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { DashboardService } from '../../../domain/services/dashboard.service.js';
import type { ApiResponse, DashboardStats } from '@aura/types';

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  getStats = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const stats = await this.dashboardService.getStats(req.user!.sub);
      res.status(200).json({ success: true, data: stats } satisfies ApiResponse<DashboardStats>);
    } catch (err) {
      next(err);
    }
  };
}
