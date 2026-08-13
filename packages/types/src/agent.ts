import type { UUID } from './common';
import type { RoutingStrategy } from './ai';

export type AgentTurnStatus = 'completed' | 'confirmation_required' | 'error';

export interface AgentConfirmation {
  tool: string;
  args: Record<string, unknown>;
  credits: number;
}

export interface AgentToolCallResult {
  name: string;
  ok: boolean;
  errorCode?: string;
}

export interface AgentTurnSelections {
  selectedProductId?: string | null;
  selectedTemplateId?: string | null;
  activeVideoJobId?: string | null;
}

/** Result of a single agent turn — returned by the Agent API. */
export interface AgentTurnResult {
  status: AgentTurnStatus;
  message: string;
  errorCode?: string;
  confirmation?: AgentConfirmation | null;
  toolCalls: AgentToolCallResult[];
  usedSteps: number;
  selections?: AgentTurnSelections;
  strategy: RoutingStrategy;
  modelId?: string;
  providerId?: string;
}

export type AgentConversationStatus = 'active' | 'cancelled';

export interface AgentConversationRow {
  id: UUID;
  userId: UUID;
  workspaceId: UUID;
  title: string;
  status: AgentConversationStatus;
  selectedProductId: UUID | null;
  selectedTemplateId: UUID | null;
  activeVideoJobId: UUID | null;
  language: string | null;
  pendingConfirmation: {
    tool: string;
    args: Record<string, unknown>;
    argsHash: string;
    credits: number;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export type AgentMessageRole = 'user' | 'assistant' | 'tool';

export interface AgentMessageRow {
  id: UUID;
  conversationId: UUID;
  role: AgentMessageRole;
  content: string | null;
  toolName: string | null;
  toolArgs: Record<string, unknown> | null;
  toolResult: { ok: boolean; data?: unknown; error?: { code: string; message: string } } | null;
  modelInfo: { strategy?: RoutingStrategy; modelId?: string; providerId?: string } | null;
  step: number | null;
  createdAt: string;
}

export interface AgentConversationDetail {
  conversation: AgentConversationRow;
  messages: AgentMessageRow[];
}

export interface CreateAgentConversationInput {
  title?: string;
  language?: string;
}

export interface SendAgentMessageInput {
  content: string;
  strategy?: RoutingStrategy;
  modelId?: string;
  providerId?: string;
  confirm?: boolean;
}