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

  const authController = new AuthController(authService);
  const dashboardController = new DashboardController(dashboardService);
  const adminController = new AdminController(userRepo, settingsRepo);
  const healthController = new HealthController();

  return {
    authController,
    dashboardController,
    adminController,
    healthController,
    userRepo,
    settingsRepo,
  };
}

export type Container = ReturnType<typeof createContainer>;
