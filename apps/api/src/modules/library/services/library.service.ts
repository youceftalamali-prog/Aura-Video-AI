import { AppError, NotFoundError } from '@aura/shared';
import type { Asset, CreateProjectInput, Project, UpdateProjectInput } from '@aura/types';
import type { ProjectRepository } from '../../../domain/repositories/project.repository.js';
import type { AssetRepository } from '../../../domain/repositories/asset.repository.js';
import type { WorkspaceRepository } from '../../../domain/repositories/workspace.repository.js';

export class LibraryService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly assets: AssetRepository,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  private async workspaceId(userId: string): Promise<string> {
    const ws = await this.workspaces.findPersonalByOwnerId(userId);
    if (!ws) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    return ws.id;
  }

  async listProjects(userId: string): Promise<Project[]> {
    return this.projects.listByUser(userId);
  }

  async getProject(userId: string, id: string): Promise<Project> {
    const p = await this.projects.findByIdForUser(id, userId);
    if (!p) throw new NotFoundError('Project');
    return p;
  }

  async createProject(
    userId: string,
    input: Omit<CreateProjectInput, 'workspaceId'>,
  ): Promise<Project> {
    const workspaceId = await this.workspaceId(userId);
    return this.projects.create(userId, { ...input, workspaceId });
  }

  async updateProject(userId: string, id: string, input: UpdateProjectInput): Promise<Project> {
    const updated = await this.projects.update(id, userId, input);
    if (!updated) throw new NotFoundError('Project');
    return updated;
  }

  async deleteProject(userId: string, id: string): Promise<void> {
    const ok = await this.projects.delete(id, userId);
    if (!ok) throw new NotFoundError('Project');
  }

  async listAssets(userId: string, type?: string): Promise<Asset[]> {
    return this.assets.listByUser(userId, type);
  }

  async getAsset(userId: string, id: string): Promise<Asset> {
    const a = await this.assets.findByIdForUser(id, userId);
    if (!a) throw new NotFoundError('Asset');
    return a;
  }

  /**
   * Export metadata for a completed video asset owned by the user.
   * Does not proxy file bytes — returns the storage URL for client download.
   */
  async exportAsset(userId: string, id: string): Promise<{
    assetId: string;
    url: string;
    mimeType: string;
    name: string;
    filename: string;
    sizeBytes: number;
  }> {
    const a = await this.getAsset(userId, id);
    if (a.status === 'deleted') {
      throw new AppError('Asset not found', 404, 'ASSET_NOT_FOUND');
    }
    if (a.status !== 'ready') {
      throw new AppError('Asset is not ready for export', 400, 'ASSET_NOT_READY');
    }
    if (!a.url) {
      throw new AppError('Asset storage unavailable', 400, 'ASSET_STORAGE_UNAVAILABLE');
    }
    const filename = this.buildDownloadFilename(a.name, a.mimeType);
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'asset_export_requested',
        assetId: a.id,
        workspaceId: a.workspaceId,
        userId,
        sizeBytes: a.sizeBytes,
        ts: new Date().toISOString(),
      }),
    );
    return {
      assetId: a.id,
      url: a.url,
      mimeType: a.mimeType,
      name: a.name,
      filename,
      sizeBytes: a.sizeBytes,
    };
  }

  /** Clean download filename — no secrets, no unsafe path chars */
  private buildDownloadFilename(name: string, mimeType: string): string {
    const base = (name || 'aura-video')
      .replace(/\.[a-z0-9]+$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'aura-video';
    const ext =
      mimeType.includes('mp4') || mimeType.includes('video')
        ? 'mp4'
        : mimeType.includes('webm')
          ? 'webm'
          : mimeType.includes('png')
            ? 'png'
            : mimeType.includes('jpeg') || mimeType.includes('jpg')
              ? 'jpg'
              : 'bin';
    return `aura-video-${base}.${ext}`;
  }

  async attachVideoToProject(
    userId: string,
    projectId: string,
    videoUrl: string,
    opts?: { durationSeconds?: number; resolution?: string; thumbnailUrl?: string },
  ): Promise<Project> {
    return this.updateProject(userId, projectId, {
      videoUrl,
      status: 'completed',
      durationSeconds: opts?.durationSeconds ?? null,
      resolution: opts?.resolution ?? null,
      thumbnailUrl: opts?.thumbnailUrl ?? null,
    });
  }
}
