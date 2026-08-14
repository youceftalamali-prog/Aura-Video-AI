import { getDb } from './db/client.js';
import { UserRepository } from './domain/repositories/user.repository.js';
import { SessionRepository } from './domain/repositories/session.repository.js';
import { WorkspaceRepository } from './domain/repositories/workspace.repository.js';
import { ProjectRepository } from './domain/repositories/project.repository.js';
import { CreditRepository } from './domain/repositories/credit.repository.js';
import { SettingsRepository } from './domain/repositories/settings.repository.js';
import { AuthService } from './domain/services/auth.service.js';
import { DashboardService } from './domain/services/dashboard.service.js';
import { AuthController } from './infrastructure/http/controllers/auth.controller.js';
import { DashboardController } from './infrastructure/http/controllers/dashboard.controller.js';
import { AdminController } from './infrastructure/http/controllers/admin.controller.js';
import { HealthController } from './infrastructure/http/controllers/health.controller.js';
import { GoogleOAuthService } from './infrastructure/auth/google-oauth.service.js';
import { createAIGateway, ProviderConfigService } from './modules/ai/gateway/index.js';
import { DbProviderConfigRepository } from './modules/ai/repositories/provider-config.repository.js';
import { TokenCryptoService } from './modules/publishing/services/token-crypto.service.js';

export function createContainer() {
  const db = getDb();

  const userRepo = new UserRepository(db);
  const sessionRepo = new SessionRepository(db);
  const workspaceRepo = new WorkspaceRepository(db);
  const projectRepo = new ProjectRepository(db);
  const creditRepo = new CreditRepository(db);
  const settingsRepo = new SettingsRepository(db);

  const authService = new AuthService(userRepo, sessionRepo, workspaceRepo, creditRepo);
  const dashboardService = new DashboardService(userRepo, workspaceRepo, projectRepo, creditRepo);
  const googleOAuthService = new GoogleOAuthService();

  const providerConfigService = new ProviderConfigService(
    new DbProviderConfigRepository(db),
    new TokenCryptoService(),
  );
  const aiGateway = createAIGateway({ configService: providerConfigService });

  const authController = new AuthController(authService, googleOAuthService);
  const dashboardController = new DashboardController(dashboardService);
  const adminController = new AdminController(userRepo, settingsRepo, providerConfigService, aiGateway);
  const healthController = new HealthController();

  return {
    authController,
    dashboardController,
    adminController,
    healthController,
    userRepo,
    settingsRepo,
    providerConfigService,
    aiGateway,
  };
}

export type Container = ReturnType<typeof createContainer>;
