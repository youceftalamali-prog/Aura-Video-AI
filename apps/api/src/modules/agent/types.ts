import type { RoutingStrategy } from '@aura/types';
import type { AgentToolDefinition } from './tools/agent-tool.js';

/** Per-request context scoped to the authenticated user/workspace. */
export interface AgentContext {
  userId: string;
  workspaceId: string;
  role: string;
  conversationId: string;
  selectedProductId?: string | null;
  selectedTemplateId?: string | null;
  activeVideoJobId?: string | null;
  language?: string | null;
  strategy: RoutingStrategy;
  modelId?: string;
  providerId?: string;
}

export interface AgentToolCall {
  name: string;
  args: Record<string, unknown>;
  argsHash: string;
  step: number;
}

export interface AgentToolResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

export type AgentTurnStatus = 'completed' | 'confirmation_required' | 'error';

export interface AgentTurnResult {
  status: AgentTurnStatus;
  message: string;
  errorCode?: string;
  confirmation?: {
    tool: string;
    args: Record<string, unknown>;
    credits: number;
  } | null;
  toolCalls: Array<{ name: string; ok: boolean; errorCode?: string }>;
  usedSteps: number;
  selections?: {
    selectedProductId?: string | null;
    selectedTemplateId?: string | null;
    activeVideoJobId?: string | null;
  };
  strategy: RoutingStrategy;
  modelId?: string;
  providerId?: string;
}

export interface AgentDecision {
  action: 'tool' | 'answer';
  thought?: string | null;
  tool?: string | null;
  args?: Record<string, unknown> | null;
  answer?: string | null;
}

export interface PendingConfirmation {
  tool: string;
  args: Record<string, unknown>;
  argsHash: string;
  credits: number;
  createdAt: string;
  payload?: unknown;
}

export interface AgentConversationRow {
  id: string;
  userId: string;
  workspaceId: string;
  title: string;
  status: 'active' | 'cancelled';
  selectedProductId: string | null;
  selectedTemplateId: string | null;
  activeVideoJobId: string | null;
  language: string | null;
  pendingConfirmation: PendingConfirmation | null;
  createdAt: string;
  updatedAt: string;
}

export type AgentMessageRole = 'user' | 'assistant' | 'tool';

export interface AgentMessageRow {
  id: string;
  conversationId: string;
  role: AgentMessageRole;
  content: string | null;
  toolName: string | null;
  toolArgs: Record<string, unknown> | null;
  toolResult: AgentToolResult | null;
  modelInfo: { strategy?: RoutingStrategy; modelId?: string; providerId?: string } | null;
  step: number | null;
  createdAt: string;
}

export interface AgentOrchestratorOptions {
  maxSteps?: number;
  perToolTimeoutMs?: number;
  turnTimeoutMs?: number;
}

export const AGENT_DEFAULTS: Required<AgentOrchestratorOptions> = {
  maxSteps: 8,
  perToolTimeoutMs: 30_000,
  turnTimeoutMs: 120_000,
};

/** Tool errors that are terminal: clear configuration/provider failures. */
export const TERMINAL_TOOL_ERROR_CODES = new Set([
  'AI_PROVIDER_UNAVAILABLE',
  'AI_MODEL_UNAVAILABLE',
  'VIDEO_PROVIDER_NOT_CONFIGURED',
  'VIDEO_PROVIDER_DISABLED',
  'VIDEO_PROVIDER_UNAVAILABLE',
]);

export type { AgentToolDefinition };
