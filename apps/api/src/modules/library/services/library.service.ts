import { AppError, NotFoundError } from '@aura/shared';
import type { Asset, CreateProjectInput, Project, UpdateProjectInput } from '@aura/types';
import type { ProjectRepository } from '../../../domain/repositories/project.repository.js';
import type { AssetRepository } from '../../../domain/repositories/asset.repository.js';
import type { WorkspaceRepository } from '../../../domain/repositories/workspace.repository.js';
import { getStorageProvider } from '../../../infrastructure/storage/index.js';

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

  async listProjects(userId: string): Promise<Project[]> { return this.projects.listByUser(userId); }
  async getProject(userId: string, id: string): Promise<Project> {
    const project = await this.projects.findByIdForUser(id, userId);
    if (!project) throw new NotFoundError('Project');
    return project;
  }
  async createProject(userId: string, input: Omit<CreateProjectInput, 'workspaceId'>): Promise<Project> {
    return this.projects.create(userId, { ...input, workspaceId: await this.workspaceId(userId) });
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
    const assets = await this.assets.listByUser(userId, type);
    return Promise.all(assets.map((asset) => this.withSignedUrl(asset)));
  }

  async getAsset(userId: string, id: string): Promise<Asset> {
    const asset = await this.assets.findByIdForUser(id, userId);
    if (!asset) throw new NotFoundError('Asset');
    return this.withSignedUrl(asset);
  }

  async exportAsset(userId: string, id: string): Promise<{
    assetId: string;
    url: string;
    mimeType: string;
    name: string;
    filename: string;
    sizeBytes: number;
  }> {
    const asset = await this.getAsset(userId, id);
    if (asset.status === 'deleted') throw new AppError('Asset not found', 404, 'ASSET_NOT_FOUND');
    if (asset.status !== 'ready') throw new AppError('Asset is not ready for export', 400, 'ASSET_NOT_READY');
    const filename = this.buildDownloadFilename(asset.name, asset.mimeType);
    console.log(JSON.stringify({
      level: 'info',
      event: 'asset_export_requested',
      assetId: asset.id,
      workspaceId: asset.workspaceId,
      userId,
      sizeBytes: asset.sizeBytes,
      ts: new Date().toISOString(),
    }));
    return { assetId: asset.id, url: asset.url, mimeType: asset.mimeType, name: asset.name, filename, sizeBytes: asset.sizeBytes };
  }

  private async withSignedUrl(asset: Asset): Promise<Asset> {
    const url = await getStorageProvider().getSignedUrl(asset.storageKey, 3600);
    return { ...asset, url };
  }

  private buildDownloadFilename(name: string, mimeType: string): string {
    const base = (name || 'aura-video').replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'aura-video';
    const ext = mimeType.includes('mp4') || mimeType.includes('video') ? 'mp4' : mimeType.includes('webm') ? 'webm' : mimeType.includes('png') ? 'png' : mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'bin';
    return `aura-video-${base}.${ext}`;
  }

  async attachVideoToProject(userId: string, projectId: string, videoUrl: string, opts?: { durationSeconds?: number; resolution?: string; thumbnailUrl?: string }): Promise<Project> {
    return this.updateProject(userId, projectId, {
      videoUrl,
      status: 'completed',
      durationSeconds: opts?.durationSeconds ?? null,
      resolution: opts?.resolution ?? null,
      thumbnailUrl: opts?.thumbnailUrl ?? null,
    });
  }
}
