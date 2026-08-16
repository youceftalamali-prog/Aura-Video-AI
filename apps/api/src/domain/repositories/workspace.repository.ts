import { and, eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { workspaces } from '../../db/schema.js';
import type { CreateWorkspaceInput, Workspace } from '@aura/types';
import { slugify } from '@aura/shared';

export class WorkspaceRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Workspace | null> {
    const rows = await this.db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    return (rows[0] as unknown as Workspace | undefined) ?? null;
  }

  async findByOwnerId(ownerId: string): Promise<Workspace[]> {
    const rows = await this.db.select().from(workspaces).where(eq(workspaces.ownerId, ownerId));
    return rows as unknown as Workspace[];
  }

  async findPersonalByOwnerId(ownerId: string): Promise<Workspace | null> {
    const rows = await this.db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.ownerId, ownerId), eq(workspaces.isPersonal, true)))
      .limit(1);
    return (rows[0] as unknown as Workspace | undefined) ?? null;
  }

  async findOwnedById(ownerId: string, workspaceId: string): Promise<Workspace | null> {
    const rows = await this.db
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerId, ownerId)))
      .limit(1);
    return (rows[0] as unknown as Workspace | undefined) ?? null;
  }

  async create(ownerId: string, input: CreateWorkspaceInput): Promise<Workspace> {
    const baseSlug = input.slug ?? slugify(input.name);
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const rows = await this.db
      .insert(workspaces)
      .values({
        name: input.name,
        slug,
        ownerId,
        isPersonal: input.isPersonal ?? true,
      })
      .returning();
    return rows[0] as unknown as Workspace;
  }
}
