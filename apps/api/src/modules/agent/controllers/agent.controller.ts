import type { Response, NextFunction } from 'express';
import { AppError, NotFoundError } from '@aura/shared';
import type { WorkspaceRepository } from '../../../domain/repositories/workspace.repository.js';
import type { AuthenticatedRequest } from '../../../infrastructure/http/middleware/auth.middleware.js';
import type { AgentConversationRepository } from '../repositories/agent-conversation.repository.js';
import type { AgentOrchestratorService } from '../services/agent-orchestrator.service.js';
import { createConversationSchema, listConversationsQuerySchema, sendMessageSchema } from '../dto/agent.schemas.js';

export class AgentController {
  constructor(
    private readonly orchestrator: AgentOrchestratorService,
    private readonly conversations: AgentConversationRepository,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  private async workspaceId(userId: string): Promise<string> {
    const workspace = await this.workspaces.findPersonalByOwnerId(userId);
    if (!workspace) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    return workspace.id;
  }

  private async ownedConversation(req: AuthenticatedRequest, id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new NotFoundError('Conversation');
    }
    const conversation = await this.conversations.findById(id);
    if (!conversation || conversation.userId !== req.user!.sub || conversation.workspaceId !== (await this.workspaceId(req.user!.sub))) {
      throw new NotFoundError('Conversation');
    }
    return conversation;
  }

  createConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createConversationSchema.parse(req.body ?? {});
      const workspaceId = await this.workspaceId(req.user!.sub);
      const conversation = await this.conversations.create({
        userId: req.user!.sub,
        workspaceId,
        title: body.title,
        language: body.language ?? null,
      });
      res.status(201).json({ success: true, data: conversation });
    } catch (err) {
      next(err);
    }
  };

  listConversations = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = listConversationsQuerySchema.parse(req.query);
      const conversations = await this.conversations.listByUser(req.user!.sub, query.limit ?? 50);
      res.status(200).json({ success: true, data: conversations });
    } catch (err) {
      next(err);
    }
  };

  getConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params['id'] as string;
      const conversation = await this.ownedConversation(req, id);
      const messages = await this.conversations.listMessages(conversation.id);
      res.status(200).json({ success: true, data: { conversation, messages } });
    } catch (err) {
      next(err);
    }
  };

  sendMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = sendMessageSchema.parse(req.body);
      const workspaceId = await this.workspaceId(req.user!.sub);
      const turn = await this.orchestrator.processMessage({
        userId: req.user!.sub,
        role: req.user!.role,
        workspaceId,
        conversationId: req.params['id'] as string,
        content: body.content,
        strategy: body.strategy,
        modelId: body.modelId,
        providerId: body.providerId,
        confirm: body.confirm,
      });
      res.status(200).json({ success: true, data: turn });
    } catch (err) {
      next(err);
    }
  };

  cancelConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversation = await this.ownedConversation(req, req.params['id'] as string);
      const updated =
        conversation.pendingConfirmation
          ? await this.conversations.update(conversation.id, { pendingConfirmation: null })
          : conversation.status === 'active'
            ? await this.conversations.update(conversation.id, { status: 'cancelled' })
            : conversation;
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };
}
