import type { PublicUser } from './user';
import type { Workspace } from './workspace';
import type { CreditWallet } from './credit';

export interface DashboardStats {
  user: PublicUser;
  workspace: Workspace;
  projectsCount: number;
  videosCount: number;
  credits: CreditWallet;
}

export interface HealthCheck {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  timestamp: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    storage: 'up' | 'down';
  };
}
