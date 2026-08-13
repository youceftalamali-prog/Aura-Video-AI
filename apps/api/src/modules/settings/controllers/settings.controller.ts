import type { NextFunction, Response } from 'express';
import type { ApiResponse, UserSettingsPayload, WorkspaceSettingsPayload } from '@aura/types';
import { AuthorizationError, NotFoundError } from '@aura/shared';
import type { UserRepository } from '../../../domain/repositories/user.repository.js';
import type { WorkspaceRepository } from '../../../domain/repositories/workspace.repository.js';
import type { AuthenticatedRequest } from '../../../infrastructure/http/middleware/auth.middleware.js';
import { updateUserPreferencesSchema, updateWorkspaceSettingsSchema } from '../dto/settings.schemas.js';
import type { SettingsResolver } from '../services/settings-resolver.service.js';
import type { UserPreferencesRepository } from '../repositories/user-preferences.repository.js';
import type { WorkspaceSettingsRepository } from '../repositories/workspace-settings.repository.js';

export class SettingsController {
  constructor(
    private readonly users: UserRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly resolver: SettingsResolver,
    private readonly userPreferences: UserPreferencesRepository,
    private readonly workspaceSettings: WorkspaceSettingsRepository,
  ) {}

  getMySettings = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const user = await this.users.findById(userId);
      if (!user) throw new NotFoundError('User not found');

      const personalWorkspace = await this.workspaces.findPersonalByOwnerId(userId);
      const preferences = await this.resolver.ensureUserPreferences(userId, user.preferredLanguage || 'en');
      const resolved = await this.resolver.resolveAll(
        { userId, workspaceId: personalWorkspace?.id ?? null },
        {},
        user.preferredLanguage || 'en',
      );

      const payload: UserSettingsPayload = {
        profile: this.users.toPublic(user),
        preferences,
        resolved,
        workspace: personalWorkspace
          ? { id: personalWorkspace.id, name: personalWorkspace.name, slug: personalWorkspace.slug, ownerId: personalWorkspace.ownerId }
          : null,
        updatedAt: preferences.updatedAt ?? undefined,
      };
      res.status(200).json({ success: true, data: payload } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  updateMySettings = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const patch = updateUserPreferencesSchema.parse(req.body);

      const user = await this.users.findById(userId);
      if (!user) throw new NotFoundError('User not found');

      const existing = await this.resolver.ensureUserPreferences(userId, user.preferredLanguage || 'en');

      await this.userPreferences.upsert(userId, {
        ...patch,
        notifications:
          patch.notifications
            ? { ...existing.notifications, ...patch.notifications }
            : undefined,
      });

      if (patch.language) {
        await this.users.updatePreferredLanguage(userId, patch.language);
      }

      const personalWorkspace = await this.workspaces.findPersonalByOwnerId(userId);
      const preferences = await this.resolver.ensureUserPreferences(userId, user.preferredLanguage || 'en');
      const resolved = await this.resolver.resolveAll(
        { userId, workspaceId: personalWorkspace?.id ?? null },
        {},
        user.preferredLanguage || 'en',
      );

      const payload: UserSettingsPayload = {
        profile: this.users.toPublic(user),
        preferences: (await this.userPreferences.getByUserId(userId)) ?? preferences,
        resolved,
        workspace: personalWorkspace
          ? { id: personalWorkspace.id, name: personalWorkspace.name, slug: personalWorkspace.slug, ownerId: personalWorkspace.ownerId }
          : null,
      };
      res.status(200).json({ success: true, data: payload } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  getWorkspaceSettings = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const requestedId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined;
      const workspace = requestedId
        ? await this.resolveOwnedWorkspace(userId, requestedId)
        : await this.workspaces.findPersonalByOwnerId(userId);

      if (!workspace) throw new NotFoundError('Workspace not found');

      const settings = await this.resolver.ensureWorkspaceSettings(workspace.id);
      const resolved = await this.resolver.resolveAll({ userId, workspaceId: workspace.id });

      const payload: WorkspaceSettingsPayload = {
        workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, ownerId: workspace.ownerId },
        settings,
        resolved,
        updatedAt: settings.updatedAt ?? undefined,
      };
      res.status(200).json({ success: true, data: payload } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  updateWorkspaceSettings = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user!.sub;
      const patch = updateWorkspaceSettingsSchema.parse(req.body);
      const requestedId = patch.workspaceId ?? (typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined);
      const workspace = requestedId
        ? await this.resolveOwnedWorkspace(userId, requestedId)
        : await this.workspaces.findPersonalByOwnerId(userId);

      if (!workspace) throw new NotFoundError('Workspace not found');

      await this.workspaceSettings.upsert(workspace.id, {
        defaultAiModel: patch.defaultAiModel,
        aiStrategy: patch.aiStrategy,
      });

      const settings = (await this.workspaceSettings.getByWorkspaceId(workspace.id)) ?? (await this.resolver.ensureWorkspaceSettings(workspace.id));
      const resolved = await this.resolver.resolveAll({ userId, workspaceId: workspace.id });

      const payload: WorkspaceSettingsPayload = {
        workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, ownerId: workspace.ownerId },
        settings,
        resolved,
        updatedAt: settings.updatedAt ?? undefined,
      };
      res.status(200).json({ success: true, data: payload } satisfies ApiResponse);
    } catch (err) {
      next(err);
    }
  };

  private async resolveOwnedWorkspace(userId: string, workspaceId: string) {
    const workspace = await this.workspaces.findById(workspaceId);
    if (!workspace) return null;
    if (workspace.ownerId !== userId) {
      throw new AuthorizationError('Not allowed to manage this workspace');
    }
    return workspace;
  }
}