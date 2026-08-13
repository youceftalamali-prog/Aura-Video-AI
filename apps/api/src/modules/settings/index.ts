import { getEnv } from '@aura/config';
import { getDb } from '../../db/client.js';
import { SettingsRepository } from '../../domain/repositories/settings.repository.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { WorkspaceRepository } from '../../domain/repositories/workspace.repository.js';
import { SettingsController } from './controllers/settings.controller.js';
import { DbUserPreferencesRepository } from './repositories/user-preferences.repository.js';
import { DbWorkspaceSettingsRepository } from './repositories/workspace-settings.repository.js';
import { createSettingsRoutes } from './routes/settings.routes.js';
import { SettingsResolver } from './services/settings-resolver.service.js';

export function createSettingsModule() {
  const db = getDb();
  const env = getEnv();
  const users = new UserRepository(db);
  const workspaces = new WorkspaceRepository(db);
  const systemSettings = new SettingsRepository(db);
  const userPreferences = new DbUserPreferencesRepository(db);
  const workspaceSettings = new DbWorkspaceSettingsRepository(db);
  const resolver = new SettingsResolver(userPreferences, workspaceSettings, systemSettings, {
    envDefaultModel: env.OPENROUTER_DEFAULT_MODEL || env.AI_MODEL,
  });

  const controller = new SettingsController(users, workspaces, resolver, userPreferences, workspaceSettings);
  const routes = createSettingsRoutes(controller);

  return { routes, controller, resolver, userPreferences, workspaceSettings, systemSettings };
}

export { SettingsController } from './controllers/settings.controller.js';
export { SettingsResolver } from './services/settings-resolver.service.js';
export {
  DbUserPreferencesRepository,
  InMemoryUserPreferencesRepository,
} from './repositories/user-preferences.repository.js';
export type { UserPreferencesRepository, UserPreferencesRecord } from './repositories/user-preferences.repository.js';
export {
  DbWorkspaceSettingsRepository,
  InMemoryWorkspaceSettingsRepository,
} from './repositories/workspace-settings.repository.js';
export type {
  WorkspaceSettingsRepository,
  WorkspaceSettingsRecord,
} from './repositories/workspace-settings.repository.js';
export {
  updateUserPreferencesSchema,
  updateWorkspaceSettingsSchema,
  languageCodeSchema,
  aiStrategySchema,
  appearanceSchema,
  aspectRatioSchema,
  resolutionSchema,
} from './dto/settings.schemas.js';
export { DEFAULT_NOTIFICATIONS, DEFAULT_STRATEGY } from './services/defaults.js';