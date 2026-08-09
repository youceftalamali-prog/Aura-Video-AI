import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { BrandKitService } from '../services/brand-kit.service.js';
import type { TemplateCatalogService } from '../services/template-catalog.service.js';
import type { VoiceService } from '../services/voice.service.js';
import type { CaptionsService } from '../services/captions.service.js';
import type { MusicService } from '../services/music.service.js';
import type { StudioProjectService } from '../services/studio-project.service.js';
import {
  brandKitUpdateSchema,
  voiceBodySchema,
  captionsFromTextSchema,
  captionsFromAudioSchema,
  studioStatePatchSchema,
  musicMixSchema,
} from '../dto/schemas.js';
import type { ApiResponse } from '@aura/types';
import { WorkspaceRepository } from '../../../domain/repositories/workspace.repository.js';
import type { Database } from '../../../db/client.js';

export class StudioController {
  private readonly workspaces: WorkspaceRepository;

  constructor(
    private readonly brandKit: BrandKitService,
    private readonly templates: TemplateCatalogService,
    private readonly voice: VoiceService,
    private readonly captions: CaptionsService,
    private readonly music: MusicService,
    private readonly projects: StudioProjectService,
    db: Database,
  ) {
    this.workspaces = new WorkspaceRepository(db);
  }

  private async workspaceIdForUser(userId: string): Promise<string> {
    const ws = await this.workspaces.findPersonalByOwnerId(userId);
    if (!ws) throw new Error('Workspace not found');
    return ws.id;
  }

  getBrandKit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const workspaceId = await this.workspaceIdForUser(req.user!.sub);
      const data = await this.brandKit.get(workspaceId);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  updateBrandKit = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = brandKitUpdateSchema.parse(req.body);
      const workspaceId = await this.workspaceIdForUser(req.user!.sub);
      const data = await this.brandKit.update(workspaceId, body);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  listTemplates = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = this.templates.listDefinitions();
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  getTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = this.templates.getDefinition(req.params.id as string);
      if (!data) {
        res.status(404).json({ success: false, error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found' } });
        return;
      }
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  generateVoice = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = voiceBodySchema.parse(req.body);
      const workspaceId = body.workspaceId || (await this.workspaceIdForUser(req.user!.sub));
      const data = await this.voice.generate({ ...body, workspaceId });
      res.status(201).json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  captionsFromText = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = captionsFromTextSchema.parse(req.body);
      const data = this.captions.fromScriptText(body.text, body.totalDuration, body.style);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  captionsFromAudio = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = captionsFromAudioSchema.parse(req.body);
      const data = await this.captions.fromAudioUrl(body.audioUrl);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  listMusic = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = this.music.listTracks();
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  validateMusic = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = musicMixSchema.parse(req.body);
      const data = this.music.resolveMix(body);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  getProjectState = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.projects.getState(req.params.id as string, req.user!.sub);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };

  saveProjectState = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const body = studioStatePatchSchema.parse(req.body);
      const data = await this.projects.saveState(req.params.id as string, req.user!.sub, body as never);
      res.json({ success: true, data } satisfies ApiResponse);
    } catch (e) { next(e); }
  };
}
