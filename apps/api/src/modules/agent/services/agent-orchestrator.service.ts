import { AppError, NotFoundError } from '@aura/shared';
import { z } from 'zod';
import type { RoutingStrategy } from '@aura/types';
import type { AIGateway } from '../../ai/gateway/ai-gateway.js';
import type { AgentConversationRepository } from '../repositories/agent-conversation.repository.js';
import type { AgentToolDefinition } from '../tools/agent-tool.js';
import type { AgentToolRegistry } from '../tools/registry.js';
import {
  AGENT_DEFAULTS,
  TERMINAL_TOOL_ERROR_CODES,
  type AgentContext,
  type AgentDecision,
  type AgentMessageRow,
  type AgentOrchestratorOptions,
  type AgentTurnResult,
  type PendingConfirmation,
} from '../types.js';
import { deterministicHash } from './tool-call-hash.js';

const MAX_HISTORY_MESSAGES = 20;
const MAX_CONTENT_PROMPT_CHARS = 4000;
const MAX_TOOL_RESULT_PROMPT_CHARS = 1500;
const MAX_TOOL_ARGS_PROMPT_CHARS = 800;

const AFFIRMATIVE = new Set([
  'yes', 'y', 'ok', 'okay', 'sure', 'confirm', 'continue', 'go ahead', 'do it', 'proceed', 'let s go', "let's go",
  'نعم', 'أكمل', 'تابع', 'موافق', 'اعملها', 'استمر',
]);
const NEGATIVE = new Set([
  'no', 'n', 'cancel', 'stop', 'don t', "don't", 'abort', 'never mind', 'not now',
  'لا', 'إلغاء', 'أوقف', 'توقف',
]);

const agentDecisionSchema = z.object({
  action: z.enum(['tool', 'answer']),
  thought: z.string().max(2000).nullish(),
  tool: z.string().max(120).nullish(),
  args: z.record(z.string(), z.unknown()).nullish(),
  answer: z.string().max(8000).nullish(),
});

const TERMINAL_MESSAGES: Record<string, string> = {
  AI_PROVIDER_UNAVAILABLE: 'AI is not configured. Please add an AI provider API key in developer settings before continuing.',
  AI_MODEL_UNAVAILABLE: 'The requested AI model is not available. Please try again or choose another model.',
  VIDEO_PROVIDER_NOT_CONFIGURED: 'The video provider is not configured, so video generation cannot continue.',
  VIDEO_PROVIDER_DISABLED: 'The video provider is disabled, so video generation cannot continue.',
  VIDEO_PROVIDER_UNAVAILABLE: 'The video provider is currently unavailable, so video generation cannot continue.',
};

const SECRET_KEY_PATTERN = /(api[_-]?key|secret|token|password|credential|authorization|encrypted)/i;

export class AgentOrchestratorService {
  private readonly options: Required<AgentOrchestratorOptions>;

  constructor(
    private readonly gateway: AIGateway,
    private readonly registry: AgentToolRegistry,
    private readonly conversations: AgentConversationRepository,
    options: AgentOrchestratorOptions = {},
  ) {
    this.options = {
      maxSteps: options.maxSteps ?? AGENT_DEFAULTS.maxSteps,
      perToolTimeoutMs: options.perToolTimeoutMs ?? AGENT_DEFAULTS.perToolTimeoutMs,
      turnTimeoutMs: options.turnTimeoutMs ?? AGENT_DEFAULTS.turnTimeoutMs,
    };
  }

  async processMessage(input: {
    userId: string;
    role?: string;
    workspaceId: string;
    conversationId: string;
    content: string;
    strategy?: RoutingStrategy;
    modelId?: string;
    providerId?: string;
    confirm?: boolean;
  }): Promise<AgentTurnResult> {
    const turnStarted = Date.now();
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation || conversation.userId !== input.userId || conversation.workspaceId !== input.workspaceId) {
      throw new NotFoundError('Conversation');
    }

    const strategy = input.strategy ?? 'balanced';
    const ctx: AgentContext = {
      userId: input.userId,
      workspaceId: input.workspaceId,
      role: conversation.userId === input.userId ? input.role ?? 'user' : 'user',
      conversationId: conversation.id,
      selectedProductId: conversation.selectedProductId,
      selectedTemplateId: conversation.selectedTemplateId,
      activeVideoJobId: conversation.activeVideoJobId,
      language: conversation.language,
      strategy,
      modelId: input.modelId,
      providerId: input.providerId,
    };

    const seen = new Set<string>();
    let step = 0;
    const toolCalls: AgentTurnResult['toolCalls'] = [];
    let pending = conversation.pendingConfirmation;

    if (pending && (input.confirm || isAffirmative(input.content))) {
      await this.conversations.addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: truncate(input.content, MAX_CONTENT_PROMPT_CHARS),
      });
      const result = await this.executeConfirmedTool(ctx, pending, toolCalls, step);
      await this.conversations.update(conversation.id, { pendingConfirmation: null });
      const selections = await this.persistSelections(conversation.id, ctx);
      if (result.status === 'error') {
        return {
          status: 'error',
          errorCode: result.errorCode,
          message: result.message,
          toolCalls,
          usedSteps: step,
          selections,
          strategy,
          modelId: input.modelId,
          providerId: input.providerId,
        };
      }
      step += 1;
      seen.add(`${pending.tool}:${pending.argsHash}`);
    } else if (pending && isNegative(input.content)) {
      await this.conversations.addMessage({
        conversationId: conversation.id,
        role: 'user',
        content: truncate(input.content, MAX_CONTENT_PROMPT_CHARS),
      });
      await this.conversations.update(conversation.id, { pendingConfirmation: null });
      return {
        status: 'completed',
        message: 'Cancelled — no action was executed.',
        toolCalls,
        usedSteps: 0,
        strategy,
        modelId: input.modelId,
        providerId: input.providerId,
      };
    } else if (pending) {
      await this.conversations.update(conversation.id, { pendingConfirmation: null });
      pending = null;
    }

    await this.conversations.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: truncate(input.content, MAX_CONTENT_PROMPT_CHARS),
    });

    const catalog = this.registry.list(ctx.role).map((t) => this.toolCatalogEntry(t));

    while (true) {
      if (Date.now() - turnStarted >= this.options.turnTimeoutMs) {
        await this.persistAssistant(conversation.id, 'I could not finish within the time limit. Please try again.', strategy, input.modelId, input.providerId);
        return {
          status: 'error',
          errorCode: 'AGENT_TURN_TIMEOUT',
          message: 'The request took too long and was stopped.',
          toolCalls,
          usedSteps: step,
          strategy,
          modelId: input.modelId,
          providerId: input.providerId,
        };
      }

      const history = await this.conversations.listMessages(conversation.id, MAX_HISTORY_MESSAGES);
      let decision: AgentDecision;
      try {
        decision = await this.decide(ctx, history, catalog);
      } catch (err) {
        const handled = this.handleModelError(err, toolCalls, step, strategy, input.modelId, input.providerId);
        await this.persistAssistant(conversation.id, handled.message, strategy, input.modelId, input.providerId);
        return handled;
      }

      if (decision.action === 'answer' || !decision.tool) {
        const answer = decision.answer?.trim() || 'I could not answer that.';
        await this.persistAssistant(conversation.id, truncate(answer, 8000), strategy, input.modelId, input.providerId);
        return {
          status: 'completed',
          message: answer,
          toolCalls,
          usedSteps: step,
          selections: await this.readSelections(conversation.id),
          strategy,
          modelId: input.modelId,
          providerId: input.providerId,
        };
      }

      step += 1;
      if (step > this.options.maxSteps) {
        const message = `I reached the maximum number of tool steps (${this.options.maxSteps}) without completing your request. Please rephrase or continue.`;
        await this.persistAssistant(conversation.id, message, strategy, input.modelId, input.providerId);
        return {
          status: 'completed',
          message,
          toolCalls,
          usedSteps: step - 1,
          strategy,
          modelId: input.modelId,
          providerId: input.providerId,
        };
      }

      const toolDef = this.registry.resolveForRole(decision.tool, ctx.role);
      if (!toolDef) {
        await this.persistToolError(conversation.id, decision.tool, { code: 'AGENT_TOOL_FORBIDDEN', message: 'This tool is not available.' }, step);
        toolCalls.push({ name: decision.tool, ok: false, errorCode: 'AGENT_TOOL_FORBIDDEN' });
        continue;
      }

      let args: Record<string, unknown>;
      try {
        args = this.registry.validateArgs(toolDef, decision.args ?? {});
      } catch (err) {
        const error = toToolError(err);
        await this.persistToolError(conversation.id, toolDef.name, error, step);
        toolCalls.push({ name: toolDef.name, ok: false, errorCode: error.code });
        continue;
      }

      const argsHash = deterministicHash(args);
      const seenKey = `${toolDef.name}:${argsHash}`;
      if (seen.has(seenKey)) {
        const error = { code: 'AGENT_TOOL_DUPLICATE', message: 'This exact tool call was already made in this turn.' };
        await this.persistToolError(conversation.id, toolDef.name, error, step);
        toolCalls.push({ name: toolDef.name, ok: false, errorCode: error.code });
        continue;
      }
      seen.add(seenKey);

      if (toolDef.confirmation) {
        const outcome = await this.requestConfirmation(ctx, toolDef, args, argsHash, step);
        if (outcome.status !== 'loop') {
          await this.conversations.update(conversation.id, { pendingConfirmation: outcome.pending });
          if (outcome.status === 'error') {
            toolCalls.push({ name: toolDef.name, ok: false, errorCode: outcome.errorCode });
            return {
              status: 'error',
              errorCode: outcome.errorCode,
              message: outcome.message ?? 'The action could not be prepared.',
              toolCalls,
              usedSteps: step,
              strategy,
              modelId: input.modelId,
              providerId: input.providerId,
            };
          }
          await this.persistAssistant(
            conversation.id,
            outcome.message!,
            strategy,
            input.modelId,
            input.providerId,
          );
          return {
            status: 'confirmation_required',
            message: outcome.message!,
            confirmation: { tool: toolDef.name, args, credits: outcome.pending!.credits },
            toolCalls,
            usedSteps: step,
            strategy,
            modelId: input.modelId,
            providerId: input.providerId,
          };
        }
        toolCalls.push({ name: toolDef.name, ok: false, errorCode: 'AGENT_TOOL_PREPARE_FAILED' });
        continue;
      }

      const result = await this.executeWithTimeout(ctx, toolDef, args, undefined);
      await this.persistToolResult(conversation.id, toolDef.name, args, result, step);
      toolCalls.push({ name: toolDef.name, ok: result.ok, errorCode: result.error?.code });

      if (!result.ok && result.error && TERMINAL_TOOL_ERROR_CODES.has(result.error.code)) {
        return {
          status: 'error',
          errorCode: result.error.code,
          message: TERMINAL_MESSAGES[result.error.code] ?? result.error.message,
          toolCalls,
          usedSteps: step,
          strategy,
          modelId: input.modelId,
          providerId: input.providerId,
        };
      }

      this.applySelections(ctx, toolDef.name, args, result.data);
      await this.persistSelections(conversation.id, ctx);
    }
  }

  private async executeConfirmedTool(
    ctx: AgentContext,
    pending: PendingConfirmation,
    toolCalls: AgentTurnResult['toolCalls'],
    step: number,
  ): Promise<AgentTurnResult | { status: 'loop' }> {
    const toolDef = this.registry.resolveForRole(pending.tool, ctx.role);
    if (!toolDef) {
      return {
        status: 'error',
        errorCode: 'AGENT_TOOL_FORBIDDEN',
        message: 'The pending action is no longer available.',
        toolCalls,
        usedSteps: 0,
        strategy: ctx.strategy,
        modelId: ctx.modelId,
        providerId: ctx.providerId,
      };
    }
    const result = await this.executeWithTimeout(ctx, toolDef, pending.args, pending.payload);
    await this.persistToolResult(ctx.conversationId, toolDef.name, pending.args, result, step);
    toolCalls.push({ name: toolDef.name, ok: result.ok, errorCode: result.error?.code });

    if (!result.ok) {
      if (result.error && TERMINAL_TOOL_ERROR_CODES.has(result.error.code)) {
        return {
          status: 'error',
          errorCode: result.error.code,
          message: TERMINAL_MESSAGES[result.error.code] ?? result.error.message,
          toolCalls,
          usedSteps: 0,
          strategy: ctx.strategy,
          modelId: ctx.modelId,
          providerId: ctx.providerId,
        };
      }
      return {
        status: 'completed',
        message: `I could not complete the action: ${result.error?.message ?? 'unknown error'}.`,
        toolCalls,
        usedSteps: 0,
        strategy: ctx.strategy,
        modelId: ctx.modelId,
        providerId: ctx.providerId,
      };
    }

    this.applySelections(ctx, toolDef.name, pending.args, result.data);
    return { status: 'loop' };
  }

  private async requestConfirmation(
    ctx: AgentContext,
    toolDef: AgentToolDefinition,
    args: Record<string, unknown>,
    argsHash: string,
    step: number,
  ): Promise<{ status: 'loop' | 'error' | 'confirm'; pending?: PendingConfirmation; message?: string; errorCode?: string }> {
    try {
      const prepared = toolDef.prepare
        ? await this.withTimeout(toolDef.prepare(ctx, args), this.options.perToolTimeoutMs, toolDef.name)
        : undefined;
      const estimate = toolDef.estimate
        ? await this.withTimeout(toolDef.estimate(ctx, args, prepared), this.options.perToolTimeoutMs, toolDef.name)
        : { credits: 0 };
      const pending: PendingConfirmation = {
        tool: toolDef.name,
        args,
        argsHash,
        credits: estimate.credits,
        createdAt: new Date().toISOString(),
        payload: prepared,
      };
      return {
        status: 'confirm',
        pending,
        message: `I can perform "${toolDef.name}". It will use approximately ${estimate.credits} credits. Continue?`,
      };
    } catch (err) {
      const error = toToolError(err);
      await this.persistToolError(ctx.conversationId, toolDef.name, error, step);
      return { status: 'error', errorCode: error.code, message: error.message };
    }
  }

  private async executeWithTimeout(
    ctx: AgentContext,
    toolDef: AgentToolDefinition,
    args: Record<string, unknown>,
    prepared: unknown,
  ): Promise<{ ok: boolean; data?: unknown; error?: { code: string; message: string } }> {
    try {
      const data = await this.withTimeout(
        this.registry.execute(ctx, toolDef.name, args, prepared),
        this.options.perToolTimeoutMs,
        toolDef.name,
      );
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: toToolError(err) };
    }
  }

  private async decide(
    ctx: AgentContext,
    history: AgentMessageRow[],
    catalog: Array<{ name: string; description: string; params: string; confirmation: boolean }>,
  ): Promise<AgentDecision> {
    const systemPrompt = this.buildSystemPrompt(ctx, catalog);
    const userPrompt = this.buildUserPrompt(ctx, history);
    try {
      return await this.gateway.generateStructuredOutput<AgentDecision>(
        {
          systemPrompt,
          userPrompt,
          schemaDescription: JSON.stringify({
            action: '"tool" or "answer"',
            thought: 'brief reasoning string or null',
            tool: 'tool name string or null',
            args: 'object with the tool parameters or null',
            answer: 'final answer string or null',
          }),
          parse: (raw: unknown) => this.parseDecision(raw),
          modelId: ctx.modelId ?? undefined,
        },
        { strategy: ctx.strategy, providerId: ctx.providerId, workspaceId: ctx.workspaceId },
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('The AI assistant failed to produce a valid decision.', 502, 'AI_DECISION_INVALID');
    }
  }

  private parseDecision(raw: unknown): AgentDecision {
    const json = typeof raw === 'string' ? extractJsonObject(raw) : raw;
    const parsed = agentDecisionSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError('The AI assistant returned an invalid decision.', 502, 'AI_DECISION_INVALID');
    }
    const d = parsed.data;
    if (d.action === 'answer') {
      if (!d.answer?.trim()) throw new AppError('The AI assistant returned an empty answer.', 502, 'AI_DECISION_INVALID');
      return { action: 'answer', answer: d.answer };
    }
    if (!d.tool) throw new AppError('The AI assistant did not select a tool.', 502, 'AI_DECISION_INVALID');
    return { action: 'tool', thought: d.thought, tool: d.tool, args: d.args ?? {} };
  }

  private handleModelError(
    err: unknown,
    toolCalls: AgentTurnResult['toolCalls'],
    step: number,
    strategy: RoutingStrategy,
    modelId?: string,
    providerId?: string,
  ): AgentTurnResult {
    const error = err instanceof AppError ? err : new AppError('The AI assistant failed.', 502, 'AI_PROVIDER_ERROR');
    if (TERMINAL_TOOL_ERROR_CODES.has(error.code)) {
      return {
        status: 'error',
        errorCode: error.code,
        message: TERMINAL_MESSAGES[error.code] ?? error.message,
        toolCalls,
        usedSteps: step,
        strategy,
        modelId,
        providerId,
      };
    }
    if (error.code === 'AI_SCHEMA_VALIDATION' || error.code === 'AI_DECISION_INVALID') {
      return {
        status: 'error',
        errorCode: error.code,
        message: 'The AI assistant returned an invalid response. Please try again.',
        toolCalls,
        usedSteps: step,
        strategy,
        modelId,
        providerId,
      };
    }
    return {
      status: 'error',
      errorCode: error.code,
      message: error.message,
      toolCalls,
      usedSteps: step,
      strategy,
      modelId,
      providerId,
    };
  }

  private buildSystemPrompt(
    ctx: AgentContext,
    catalog: Array<{ name: string; description: string; params: string; confirmation: boolean }>,
  ): string {
    const tools = catalog
      .map(
        (t) =>
          `- ${t.name}${t.confirmation ? ' [requires confirmation]' : ''}: ${t.description} (params: ${t.params})`,
      )
      .join('\n');
    return [
      'You are the Aura Video AI assistant agent. You help users manage their products, generate marketing content, create videos, and answer billing questions by calling the tools below.',
      '',
      'Rules:',
      '- Only claim an action succeeded (video created, analysis completed, template selected, asset created, MP4 ready) when the tool result actually reports success.',
      '- If a tool fails, report its error honestly. Never invent results.',
      '- You never have access to admin tools, provider API keys, feature flags, or raw credit mutation.',
      '- If the user asks for something no tool can do, say so directly.',
      `- Reply in the user's language when known (current language: ${ctx.language ?? 'unknown'}).`,
      '',
      'Available tools:',
      tools,
      '',
      'Respond with JSON only, exactly one object:',
      '{"action":"tool","thought":"short reasoning","tool":"<tool name>","args":{...}}',
      'or {"action":"answer","thought":"short reasoning","answer":"<final answer>"}',
    ].join('\n');
  }

  private buildUserPrompt(ctx: AgentContext, history: AgentMessageRow[]): string {
    const selections = [
      ctx.selectedProductId ? `product: ${ctx.selectedProductId}` : null,
      ctx.selectedTemplateId ? `template: ${ctx.selectedTemplateId}` : null,
      ctx.activeVideoJobId ? `video job: ${ctx.activeVideoJobId}` : null,
    ].filter(Boolean);
    const header = `Conversation context:${selections.length ? ` selected ${selections.join(', ')}.` : ''} Continue the conversation.`;
    const historyText = history
      .map((m) => serializeMessage(m))
      .filter(Boolean)
      .join('\n');
    return [header, historyText].join('\n');
  }

  private toolCatalogEntry(tool: AgentToolDefinition): { name: string; description: string; params: string; confirmation: boolean } {
    return {
      name: tool.name,
      description: tool.description,
      params: tool.paramsHint,
      confirmation: Boolean(tool.confirmation),
    };
  }

  private async persistToolResult(
    conversationId: string,
    toolName: string,
    args: Record<string, unknown>,
    result: { ok: boolean; data?: unknown; error?: { code: string; message: string } },
    step: number,
  ): Promise<void> {
    await this.conversations.addMessage({
      conversationId,
      role: 'tool',
      toolName,
      toolArgs: (sanitizeForPersistence(args) ?? null) as Record<string, unknown> | null,
      toolResult: result.ok ? { ok: true, data: sanitizeForPersistence(result.data) } : { ok: false, error: result.error },
      step,
    });
  }

  private async persistToolError(
    conversationId: string,
    toolName: string,
    error: { code: string; message: string },
    step: number,
  ): Promise<void> {
    await this.conversations.addMessage({
      conversationId,
      role: 'tool',
      toolName,
      toolResult: { ok: false, error },
      step,
    });
  }

  private async persistAssistant(
    conversationId: string,
    content: string,
    strategy: RoutingStrategy,
    modelId?: string,
    providerId?: string,
  ): Promise<void> {
    await this.conversations.addMessage({
      conversationId,
      role: 'assistant',
      content,
      modelInfo: { strategy, modelId, providerId },
    });
  }

  private applySelections(ctx: AgentContext, toolName: string, args: Record<string, unknown>, data: unknown): void {
    const productId =
      (args as { productId?: string }).productId ??
      (data as { product?: { id?: string }; productId?: string } | null)?.product?.id ??
      (data as { productId?: string } | null)?.productId;
    if (toolName.startsWith('product.') && typeof productId === 'string') {
      ctx.selectedProductId = productId;
    }
    if (toolName === 'template.get') {
      const templateId = (args as { templateId?: string }).templateId;
      if (templateId) ctx.selectedTemplateId = templateId;
    }
    if (toolName === 'video.create') {
      const jobId = (data as { jobId?: string } | null)?.jobId;
      if (jobId) ctx.activeVideoJobId = jobId;
    }
    if (toolName === 'video.status' || toolName === 'video.cancel') {
      const jobId = (args as { jobId?: string }).jobId;
      if (jobId) ctx.activeVideoJobId = jobId;
    }
  }

  private async persistSelections(conversationId: string, ctx: AgentContext): Promise<AgentTurnResult['selections']> {
    await this.conversations.update(conversationId, {
      selectedProductId: ctx.selectedProductId ?? null,
      selectedTemplateId: ctx.selectedTemplateId ?? null,
      activeVideoJobId: ctx.activeVideoJobId ?? null,
    });
    return {
      selectedProductId: ctx.selectedProductId ?? null,
      selectedTemplateId: ctx.selectedTemplateId ?? null,
      activeVideoJobId: ctx.activeVideoJobId ?? null,
    };
  }

  private async readSelections(conversationId: string): Promise<AgentTurnResult['selections']> {
    const row = await this.conversations.findById(conversationId);
    if (!row) return undefined;
    return {
      selectedProductId: row.selectedProductId,
      selectedTemplateId: row.selectedTemplateId,
      activeVideoJobId: row.activeVideoJobId,
    };
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new AppError(`Tool "${label}" timed out after ${Math.round(ms / 1000)}s`, 504, 'AGENT_TOOL_TIMEOUT'));
      }, ms);
      timer.unref?.();
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }
}

function isAffirmative(content: string): boolean {
  const normalized = normalize(content);
  return AFFIRMATIVE.has(normalized) || AFFIRMATIVE.has(normalized.replace(/^[!,.،.؟? ]+|[!,.،.؟? ]+$/g, '')) || /^(yes|ok|okay|sure|نعم|أكمل|تابع)[,!.]*$/.test(normalized);
}

function isNegative(content: string): boolean {
  const normalized = normalize(content);
  return NEGATIVE.has(normalized) || NEGATIVE.has(normalized.replace(/^[!,.،.؟? ]+|[!,.،.؟? ]+$/g, ''));
}

function normalize(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, ' ');
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
}

function extractJsonObject(raw: string): unknown {
  const withoutFences = raw.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(withoutFences);
  } catch {
    const start = withoutFences.indexOf('{');
    const end = withoutFences.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFences.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function serializeMessage(message: AgentMessageRow): string {
  if (message.role === 'user') return `User: ${truncate(message.content ?? '', MAX_CONTENT_PROMPT_CHARS)}`;
  if (message.role === 'assistant') return `Assistant: ${truncate(message.content ?? '', MAX_CONTENT_PROMPT_CHARS)}`;
  const args = message.toolArgs ? truncate(JSON.stringify(sanitizeForPrompt(message.toolArgs)), MAX_TOOL_ARGS_PROMPT_CHARS) : '{}';
  let result = '';
  if (message.toolResult) {
    result = message.toolResult.ok
      ? `ok: ${truncate(JSON.stringify(sanitizeForPrompt(message.toolResult.data ?? null)), MAX_TOOL_RESULT_PROMPT_CHARS)}`
      : `error: ${message.toolResult.error?.code}: ${truncate(message.toolResult.error?.message ?? '', 500)}`;
  }
  return `Tool ${message.toolName} args=${args} => ${result}`;
}

function sanitizeForPrompt(value: unknown): unknown {
  return sanitize(value, true);
}

function sanitizeForPersistence(value: unknown): unknown {
  return sanitize(value, false);
}

function sanitize(value: unknown, forPrompt: boolean): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 2000) {
      return forPrompt ? `${value.slice(0, 2000)}…[truncated]` : `${value.slice(0, 2000)}…[truncated]`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => sanitize(v, forPrompt));
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    if (forPrompt && (key === 'imageBase64' || key === 'extracted')) continue;
    out[key] = sanitize(v, forPrompt);
  }
  return out;
}

function toToolError(err: unknown): { code: string; message: string } {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  return { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' };
}
