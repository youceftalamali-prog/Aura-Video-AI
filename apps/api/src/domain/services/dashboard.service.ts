import { NotFoundError } from '@aura/shared';
import type { DashboardStats } from '@aura/types';
import { UserRepository } from '../repositories/user.repository.js';
import { WorkspaceRepository } from '../repositories/workspace.repository.js';
import { ProjectRepository } from '../repositories/project.repository.js';
import { CreditRepository } from '../repositories/credit.repository.js';

export class DashboardService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly projectRepo: ProjectRepository,
    private readonly creditRepo: CreditRepository,
  ) {}

  async getStats(userId: string): Promise<DashboardStats> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const workspace = await this.workspaceRepo.findPersonalByOwnerId(userId);
    if (!workspace) {
      throw new NotFoundError('Workspace');
    }

    const [projectsCount, videosCount, credits] = await Promise.all([
      this.projectRepo.countByWorkspace(workspace.id),
      this.projectRepo.countVideosByWorkspace(workspace.id),
      this.creditRepo.findByWorkspaceId(workspace.id),
    ]);

    if (!credits) {
      throw new NotFoundError('Credit wallet');
    }

    return {
      user: this.userRepo.toPublic(user),
      workspace,
      projectsCount,
      videosCount,
      credits,
    };
  }
}
