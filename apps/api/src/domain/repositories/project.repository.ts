import { eq, and, desc, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { projects } from '../../db/schema.js';
import type { CreateProjectInput, Project, UpdateProjectInput } from '@aura/types';

export class ProjectRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Project | null> {
    const rows = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return (rows[0] as unknown as Project | undefined) ?? null;
  }

  async findByIdForUser(id: string, userId: string): Promise<Project | null> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .limit(1);
    return (rows[0] as unknown as Project | undefined) ?? null;
  }

  async listByUser(userId: string, limit = 50): Promise<Project[]> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt))
      .limit(limit);
    return rows as unknown as Project[];
  }

  async listByWorkspace(workspaceId: string, limit = 50): Promise<Project[]> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(desc(projects.updatedAt))
      .limit(limit);
    return rows as unknown as Project[];
  }

  async countByWorkspace(workspaceId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId));
    return result[0]?.count ?? 0;
  }

  async countVideosByWorkspace(workspaceId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), eq(projects.status, 'completed')));
    return result[0]?.count ?? 0;
  }

  async create(userId: string, input: CreateProjectInput): Promise<Project> {
    const rows = await this.db
      .insert(projects)
      .values({
        workspaceId: input.workspaceId,
        userId,
        name: input.name,
        description: input.description ?? null,
        templateId: input.templateId ?? null,
        productId: input.productId ?? null,
        status: 'draft',
      })
      .returning();
    return rows[0] as unknown as Project;
  }

  async update(id: string, userId: string, input: UpdateProjectInput): Promise<Project | null> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.status !== undefined) patch.status = input.status;
    if (input.thumbnailUrl !== undefined) patch.thumbnailUrl = input.thumbnailUrl;
    if (input.videoUrl !== undefined) patch.videoUrl = input.videoUrl;
    if (input.durationSeconds !== undefined) patch.durationSeconds = input.durationSeconds;
    if (input.resolution !== undefined) patch.resolution = input.resolution;
    const rows = await this.db
      .update(projects)
      .set(patch)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();
    return (rows[0] as unknown as Project | undefined) ?? null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();
    return rows.length > 0;
  }
}
