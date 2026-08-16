import { eq, desc } from 'drizzle-orm';
import type { RoutingStrategy } from '@aura/types';
import type { Database } from '../../../db/client.js';
import { agentConversations, agentMessages } from '../../../db/schema.js';
import type { AgentConversationRow, AgentMessageRow, AgentMessageRole, PendingConfirmation } from '../types.js';

export interface AgentMessageInput {
  conversationId: string;
  role: AgentMessageRole;
  content?: string | null;
  toolName?: string | null;
  toolArgs?: Record<string, unknown> | null;
  toolResult?: { ok: boolean; data?: unknown; error?: { code: string; message: string } } | null;
  modelInfo?: { strategy?: RoutingStrategy; modelId?: string; providerId?: string } | null;
  step?: number | null;
}

export interface AgentConversationPatch {
  title?: string;
  status?: 'active' | 'cancelled';
  selectedProductId?: string | null;
  selectedTemplateId?: string | null;
  activeVideoJobId?: string | null;
  language?: string | null;
  pendingConfirmation?: PendingConfirmation | null;
}

export interface AgentConversationRepository {
  create(input: { userId: string; workspaceId: string; title?: string; language?: string | null }): Promise<AgentConversationRow>;
  findById(id: string): Promise<AgentConversationRow | null>;
  listByUser(userId: string, limit?: number): Promise<AgentConversationRow[]>;
  update(id: string, patch: AgentConversationPatch): Promise<AgentConversationRow | null>;
  addMessage(input: AgentMessageInput): Promise<AgentMessageRow>;
  listMessages(conversationId: string, limit?: number): Promise<AgentMessageRow[]>;
}

function toConversationRow(row: typeof agentConversations.$inferSelect): AgentConversationRow {
  return {
    id: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
    title: row.title,
    status: row.status as 'active' | 'cancelled',
    selectedProductId: row.selectedProductId,
    selectedTemplateId: row.selectedTemplateId,
    activeVideoJobId: row.activeVideoJobId,
    language: row.language,
    pendingConfirmation: (row.pendingConfirmation as PendingConfirmation | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessageRow(row: typeof agentMessages.$inferSelect): AgentMessageRow {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as AgentMessageRole,
    content: row.content,
    toolName: row.toolName,
    toolArgs: (row.toolArgs as Record<string, unknown> | null) ?? null,
    toolResult: (row.toolResult as AgentMessageRow['toolResult']) ?? null,
    modelInfo: (row.modelInfo as AgentMessageRow['modelInfo']) ?? null,
    step: row.step,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DbAgentConversationRepository implements AgentConversationRepository {
  constructor(private readonly db: Database) {}

  async create(input: { userId: string; workspaceId: string; title?: string; language?: string | null }): Promise<AgentConversationRow> {
    const [row] = await this.db
      .insert(agentConversations)
      .values({
        userId: input.userId,
        workspaceId: input.workspaceId,
        title: input.title?.slice(0, 200) || 'New conversation',
        language: input.language ?? null,
      })
      .returning();
    return toConversationRow(row!);
  }

  async findById(id: string): Promise<AgentConversationRow | null> {
    const [row] = await this.db.select().from(agentConversations).where(eq(agentConversations.id, id)).limit(1);
    return row ? toConversationRow(row) : null;
  }

  async listByUser(userId: string, limit = 50): Promise<AgentConversationRow[]> {
    const rows = await this.db
      .select()
      .from(agentConversations)
      .where(eq(agentConversations.userId, userId))
      .orderBy(desc(agentConversations.updatedAt))
      .limit(limit);
    return rows.map(toConversationRow);
  }

  async update(id: string, patch: AgentConversationPatch): Promise<AgentConversationRow | null> {
    const [row] = await this.db
      .update(agentConversations)
      .set({
        ...(patch.title !== undefined ? { title: patch.title.slice(0, 200) } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.selectedProductId !== undefined ? { selectedProductId: patch.selectedProductId } : {}),
        ...(patch.selectedTemplateId !== undefined ? { selectedTemplateId: patch.selectedTemplateId } : {}),
        ...(patch.activeVideoJobId !== undefined ? { activeVideoJobId: patch.activeVideoJobId } : {}),
        ...(patch.language !== undefined ? { language: patch.language } : {}),
        ...(patch.pendingConfirmation !== undefined ? { pendingConfirmation: patch.pendingConfirmation } : {}),
        updatedAt: new Date(),
      })
      .where(eq(agentConversations.id, id))
      .returning();
    return row ? toConversationRow(row) : null;
  }

  async addMessage(input: AgentMessageInput): Promise<AgentMessageRow> {
    const [row] = await this.db
      .insert(agentMessages)
      .values({
        conversationId: input.conversationId,
        role: input.role,
        content: input.content ?? null,
        toolName: input.toolName ?? null,
        toolArgs: input.toolArgs ?? null,
        toolResult: input.toolResult ?? null,
        modelInfo: input.modelInfo ?? null,
        step: input.step ?? null,
      })
      .returning();
    return toMessageRow(row!);
  }

  async listMessages(conversationId: string, limit = 40): Promise<AgentMessageRow[]> {
    const rows = await this.db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.conversationId, conversationId))
      .orderBy(desc(agentMessages.createdAt))
      .limit(limit);
    return rows.reverse().map(toMessageRow);
  }
}

export class InMemoryAgentConversationRepository implements AgentConversationRepository {
  private conversations = new Map<string, AgentConversationRow>();
  private messages = new Map<string, AgentMessageRow[]>();
  private seq = 0;

  async create(input: { userId: string; workspaceId: string; title?: string; language?: string | null }): Promise<AgentConversationRow> {
    const id = `conv_${++this.seq}`;
    const now = new Date().toISOString();
    const row: AgentConversationRow = {
      id,
      userId: input.userId,
      workspaceId: input.workspaceId,
      title: input.title?.slice(0, 200) || 'New conversation',
      status: 'active',
      selectedProductId: null,
      selectedTemplateId: null,
      activeVideoJobId: null,
      language: input.language ?? null,
      pendingConfirmation: null,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(id, row);
    this.messages.set(id, []);
    return row;
  }

  async findById(id: string): Promise<AgentConversationRow | null> {
    return this.conversations.get(id) ?? null;
  }

  async listByUser(userId: string, limit = 50): Promise<AgentConversationRow[]> {
    return [...this.conversations.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  async update(id: string, patch: AgentConversationPatch): Promise<AgentConversationRow | null> {
    const row = this.conversations.get(id);
    if (!row) return null;
    const updated: AgentConversationRow = { ...row, ...patch, updatedAt: new Date().toISOString() };
    this.conversations.set(id, updated);
    return updated;
  }

  async addMessage(input: AgentMessageInput): Promise<AgentMessageRow> {
    const row: AgentMessageRow = {
      id: `msg_${++this.seq}`,
      conversationId: input.conversationId,
      role: input.role,
      content: input.content ?? null,
      toolName: input.toolName ?? null,
      toolArgs: input.toolArgs ?? null,
      toolResult: input.toolResult ?? null,
      modelInfo: input.modelInfo ?? null,
      step: input.step ?? null,
      createdAt: new Date().toISOString(),
    };
    const list = this.messages.get(input.conversationId) ?? [];
    list.push(row);
    this.messages.set(input.conversationId, list);
    return row;
  }

  async listMessages(conversationId: string, limit = 40): Promise<AgentMessageRow[]> {
    return [...(this.messages.get(conversationId) ?? [])].slice(-limit);
  }
}
