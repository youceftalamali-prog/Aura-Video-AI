import { and, eq, inArray } from 'drizzle-orm';
import { AppError, NotFoundError } from '@aura/shared';
import type { Asset, CreateProjectInput, Project, UpdateProjectInput } from '@aura/types';
import type { Database } from '../../../db/client.js';
import { products, templates } from '../../../db/schema.js';
import type { ProjectRepository } from '../../../domain/repositories/project.repository.js';
import type { AssetRepository } from '../../../domain/repositories/asset.repository.js';
import type { WorkspaceRepository } from '../../../domain/repositories/workspace.repository.js';
import { getStorageProvider } from '../../../infrastructure/storage/index.js';

export class LibraryService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly assets: AssetRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly db: Database,
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
    const project = await this.projects.findByIdForUser(id, userId);
    if (!project) throw new NotFoundError('Project');
    return project;
  }

  async createProject(userId: string, input: Omit<CreateProjectInput, 'workspaceId'>): Promise<Project> {
    const workspaceId = await this.workspaceId(userId);
    await this.assertProjectReferences(userId, workspaceId, input);
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
    const rows = await this.assets.listByUser(userId, type);
    return Promise.all(rows.map((asset) => this.withSignedUrl(asset)));
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
    // Do not trust the URL persisted at upload time: it may be expired or
    // stale. Export always checks ownership, readiness, object existence, and
    // creates a fresh signed URL from the server-side storage key.
    const asset = await this.assets.findByIdForUser(id, userId);
    if (!asset) throw new NotFoundError('Asset');
    if (asset.status === 'deleted') throw new AppError('Asset not found', 404, 'ASSET_NOT_FOUND');
    if (asset.status !== 'ready') throw new AppError('Asset is not ready for export', 400, 'ASSET_NOT_READY');
    if (!asset.storageKey) throw new AppError('Asset file not found', 404, 'ASSET_STORAGE_NOT_FOUND');

    const storage = getStorageProvider();
    if (!(await storage.exists(asset.storageKey))) {
      throw new AppError('Asset file not found', 404, 'ASSET_STORAGE_NOT_FOUND');
    }
    const url = await storage.getSignedUrl(asset.storageKey, 3600);
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
    return { assetId: asset.id, url, mimeType: asset.mimeType, name: asset.name, filename, sizeBytes: asset.sizeBytes };
  }

  private async assertProjectReferences(
    userId: string,
    workspaceId: string,
    input: Omit<CreateProjectInput, 'workspaceId'>,
  ): Promise<void> {
    if (input.productId) {
      const productRows = await this.db
        .select({ id: products.id })
        .from(products)
        .where(and(
          eq(products.id, input.productId),
          eq(products.workspaceId, workspaceId),
          eq(products.userId, userId),
        ))
        .limit(1);
      if (!productRows[0]) throw new NotFoundError('Product');
    }

    if (input.templateId) {
      const templateRows = await this.db
        .select({ id: templates.id })
        .from(templates)
        .where(and(
          eq(templates.id, input.templateId),
          inArray(templates.status, ['published', 'active']),
        ))
        .limit(1);
      if (!templateRows[0]) throw new NotFoundError('Template');
    }
  }

  private async withSignedUrl(asset: Asset): Promise<Asset> {
    if (asset.status !== 'ready' || !asset.storageKey) return { ...asset, url: '' };
    const storage = getStorageProvider();
    if (!(await storage.exists(asset.storageKey))) return { ...asset, url: '' };
    return { ...asset, url: await storage.getSignedUrl(asset.storageKey, 3600) };
  }

  private buildDownloadFilename(name: string, mimeType: string): string {
    const base = (name || 'aura-video')
      .replace(/\.[a-z0-9]+$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'aura-video';
    const ext = mimeType.includes('mp4') || mimeType.includes('video')
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
