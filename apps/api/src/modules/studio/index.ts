import { getDb } from '../../db/client.js';
import { getTTSProvider } from './providers/index.js';
import { BrandKitService } from './services/brand-kit.service.js';
import { TemplateCatalogService } from './services/template-catalog.service.js';
import { VoiceService } from './services/voice.service.js';
import { CaptionsService } from './services/captions.service.js';
import { MusicService } from './services/music.service.js';
import { StudioProjectService } from './services/studio-project.service.js';
import { StudioController } from './controllers/studio.controller.js';
import { createStudioRoutes } from './routes/studio.routes.js';

export function createStudioModule() {
  const db = getDb();
  const tts = getTTSProvider();
  const brandKit = new BrandKitService(db);
  const templates = new TemplateCatalogService(db);
  const voice = new VoiceService(tts);
  const captions = new CaptionsService(tts);
  const music = new MusicService();
  const projects = new StudioProjectService(db);
  const controller = new StudioController(brandKit, templates, voice, captions, music, projects, db);
  const routes = createStudioRoutes(controller);
  return { routes, controller, brandKit, templates, voice, captions, music, projects };
}
