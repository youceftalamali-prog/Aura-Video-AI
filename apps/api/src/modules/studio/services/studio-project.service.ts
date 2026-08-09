import type { Database } from '../../../db/client.js';
import { SettingsRepository } from '../../../domain/repositories/settings.repository.js';
import type { StudioProjectState } from '@aura/types';
import { eq } from 'drizzle-orm';
import { projects } from '../../../db/schema.js';
import { NotFoundError, AuthorizationError } from '@aura/shared';

const stateKey = (projectId: string) => `studio_state:${projectId}`;

export class StudioProjectService {
  private readonly settings: SettingsRepository;

  constructor(private readonly db: Database) {
    this.settings = new SettingsRepository(db);
  }

  async assertProjectAccess(projectId: string, userId: string) {
    const rows = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    const project = rows[0];
    if (!project) throw new NotFoundError('Project');
    if (project.userId !== userId) {
      // workspace owner check simplified: must be project owner for Phase 5
      throw new AuthorizationError('Project access denied');
    }
    return project;
  }

  async getState(projectId: string, userId: string): Promise<StudioProjectState> {
    await this.assertProjectAccess(projectId, userId);
    const raw = (await this.settings.get(stateKey(projectId))) as unknown as StudioProjectState | null;
    return {
      productAnalysis: null,
      creativeStrategy: null,
      script: null,
      storyboard: null,
      templateId: null,
      brandKit: null,
      voice: null,
      music: null,
      captions: null,
      scenes: [],
      lastJobId: null,
      finalAssetId: null,
      settings: {},
      ...raw,
      projectId,
    } as unknown as StudioProjectState;
  }

  async saveState(projectId: string, userId: string, patch: Partial<StudioProjectState>): Promise<StudioProjectState> {
    await this.assertProjectAccess(projectId, userId);
    const current = await this.getState(projectId, userId);
    const next: StudioProjectState = {
      ...current,
      ...patch,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    await this.settings.set(stateKey(projectId), next, 'Video studio project state');
    return next;
  }
}
