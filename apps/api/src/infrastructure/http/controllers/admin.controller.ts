import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { SettingsRepository } from '../../../domain/repositories/settings.repository.js';
import type { ApiResponse } from '@aura/types';

export class AdminController {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly settingsRepo: SettingsRepository,
  ) {}

  listUsers = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const { users, total } = await this.userRepo.list(limit, offset);
      const publicUsers = users.map((u) => this.userRepo.toPublic(u));
      res.status(200).json({
        success: true,
        data: publicUsers,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  listSettings = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.settingsRepo.list();
      res.status(200).json({ success: true, data } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  updateSetting = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { key } = req.params;
      const { value, description } = req.body as { value: unknown; description?: string };
      if (!key) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'key is required' },
        });
        return;
      }
      await this.settingsRepo.set(key, value, description);
      res.status(200).json({ success: true } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  listPlans = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Plans are stored in settings or a future plans table.
      // For Phase 1 we return static foundation plans.
      const plans = [
        {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Free',
          slug: 'free',
          description: 'Get started with basic credits',
          priceMonthly: 0,
          priceYearly: 0,
          currency: 'USD',
          creditsPerMonth: 50,
          maxProjects: 5,
          maxStorageGb: 1,
          features: ['50 credits / month', 'HD export', 'Basic templates'],
          isActive: true,
          sortOrder: 0,
        },
        {
          id: '00000000-0000-0000-0000-000000000002',
          name: 'Pro',
          slug: 'pro',
          description: 'For growing brands',
          priceMonthly: 49,
          priceYearly: 470,
          currency: 'USD',
          creditsPerMonth: 500,
          maxProjects: 100,
          maxStorageGb: 20,
          features: ['500 credits / month', '4K export', 'All templates', 'Priority support'],
          isActive: true,
          sortOrder: 1,
        },
      ];
      res.status(200).json({ success: true, data: plans } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };
}
