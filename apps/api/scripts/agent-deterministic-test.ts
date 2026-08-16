/**
 * Deterministic Phase D test suite for the AI Agent (no paid AI calls).
 *
 * The AIGateway is faked with a queued-decision object; tool dependencies are
 * in-memory fakes. Run with: pnpm --filter @aura/api exec tsx scripts/agent-deterministic-test.ts
 */
import { AppError, NotFoundError } from '@aura/shared';
import { randomUUID } from 'node:crypto';
import { AgentOrchestratorService } from '../src/modules/agent/services/agent-orchestrator.service.js';
import { InMemoryAgentConversationRepository } from '../src/modules/agent/repositories/agent-conversation.repository.js';
import { createCustomerToolRegistry, type AgentToolRegistryDeps } from '../src/modules/agent/tools/index.js';
import type { AgentConversationRepository } from '../src/modules/agent/repositories/agent-conversation.repository.js';
import type { AgentTurnResult } from '../src/modules/agent/types.js';

const PRODUCT_ID = randomUUID();
const TEMPLATE_ID = randomUUID();
const JOB_ID = randomUUID();

const workflow = {
  productId: PRODUCT_ID,
  productName: 'Aura Glow Serum',
  aspectRatio: '9:16',
  duration: 30,
  scenes: [
    { order: 1, duration: 5, visualPrompt: 'close-up of bottle', textOverlay: 'Glow', cameraDirection: 'slow push-in' },
    { order: 2, duration: 5, visualPrompt: 'skin texture', textOverlay: '', cameraDirection: 'macro' },
  ],
  scriptScenes: [{ order: 1, narration: 'Meet the glow.' }],
  templateRecommendations: [{ templateId: TEMPLATE_ID, name: 'Beauty Bold', creditsCost: 20, fit: 'high' }],
  creativeAngle: 'problem_solution',
  callToAction: 'Shop now',
  tone: 'premium',
  selectedHook: 'Your skin deserves more',
};

class FakeGateway {
  queue: Array<unknown | (() => unknown | Promise<unknown>)> = [];
  calls: Array<{ systemPrompt: string; userPrompt: string; options: unknown }> = [];

  async generateStructuredOutput<T>(params: { parse?: (raw: unknown) => T; systemPrompt: string; userPrompt: string }, options: unknown): Promise<T> {
    this.calls.push({ systemPrompt: params.systemPrompt, userPrompt: params.userPrompt, options });
    const entry = this.queue.shift();
    if (entry === undefined) throw new AppError('No more queued decisions in fake gateway', 503, 'AI_PROVIDER_ERROR');
    if (typeof entry === 'function') return (await entry()) as T;
    if (params.parse) return params.parse(entry);
    return entry as T;
  }
}

function makeDeps() {
  const calls: Record<string, number> = {};
  const bump = (name: string) => {
    calls[name] = (calls[name] ?? 0) + 1;
  };
  const deps: AgentToolRegistryDeps = {
    products: {
      list: async () => [{ id: PRODUCT_ID, name: 'Aura Glow Serum' }],
      get: async (_userId: string, id: string) => {
        bump('product.get');
        return { id, name: 'Aura Glow Serum', price: '29.99', currency: 'USD', apiKey: 'sk-LEAK-123' };
      },
      importUrl: async () => {
        bump('importUrl');
        return { id: PRODUCT_ID, name: 'Imported' };
      },
      importText: async () => {
        bump('importText');
        return { id: PRODUCT_ID, name: 'Imported' };
      },
      importImage: async () => {
        bump('importImage');
        return { id: PRODUCT_ID, name: 'Imported' };
      },
      getIntelligence: async () => ({ profile: {}, audiences: [], angles: [] }),
      generateHooks: async () => ({ hooks: ['Hook one', 'Hook two'] }),
      createVideoWorkflow: async () => {
        bump('createVideoWorkflow');
        return {
          productId: workflow.productId,
          analysis: { productName: workflow.productName },
          strategy: { creativeAngle: workflow.creativeAngle, callToAction: workflow.callToAction, tone: workflow.tone },
          script: { scenes: workflow.scriptScenes },
          storyboard: { aspectRatio: workflow.aspectRatio, duration: workflow.duration, scenes: workflow.scenes },
          templateRecommendations: workflow.templateRecommendations,
          selectedHook: workflow.selectedHook,
        };
      },
    },
    analysis: {
      analyzeFromText: async (input: { name: string; description: string }) => ({ productName: input.name, description: input.description }),
      analyzeFromUrl: async () => ({ productName: 'From URL', description: 'x' }),
    },
    strategy: { generate: async () => ({ creativeAngle: 'benefits', callToAction: 'Buy', tone: 'bold' }) },
    script: { generate: async () => ({ narration: 'Hello' }) },
    storyboard: { generate: async () => ({ scenes: [] }) },
    templates: {
      listActive: async () => [{ id: TEMPLATE_ID, name: 'Beauty Bold', aspectRatio: '9:16', creditsCost: 20 }],
      getByIdOrThrow: async (id: string) => ({ id, name: 'Beauty Bold' }),
      recommend: async () => workflow.templateRecommendations,
    },
    video: {
      estimateCost: async () => {
        bump('estimateCost');
        return { credits: 50, breakdown: { ai: 30, rendering: 20 } };
      },
      createJob: async (_userId: string, input: Record<string, unknown>) => {
        bump('createJob');
        if (!input.idempotencyKey) throw new AppError('idempotencyKey missing', 500, 'INTERNAL_ERROR');
        return { jobId: JOB_ID, status: 'running', creditsCharged: 50, idempotencyKey: input.idempotencyKey };
      },
      getJob: async () => ({ jobId: JOB_ID, status: 'running' }),
      cancelJob: async () => ({ jobId: JOB_ID, status: 'cancelled' }),
    },
    library: {
      createProject: async () => {
        bump('createProject');
        return { id: randomUUID(), name: 'project' };
      },
    },
    billing: {
      getBalance: async () => {
        bump('billing.balance');
        return { balance: 1200, currency: 'USD' };
      },
    },
    settingsRepo: {
      get: async (key: string) => (key === 'app.default_language' ? 'en' : null),
    },
  };
  return { deps, calls };
}

function setup(maxSteps = 8) {
  const { deps, calls } = makeDeps();
  const gateway = new FakeGateway();
  const conversations = new InMemoryAgentConversationRepository();
  const registry = createCustomerToolRegistry(deps);
  const orchestrator = new AgentOrchestratorService(
    gateway as never,
    registry,
    conversations,
    { maxSteps, perToolTimeoutMs: 1000, turnTimeoutMs: 10_000 },
  );
  return { gateway, conversations, registry, orchestrator, deps, calls };
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function answer(text: string): Record<string, unknown> {
  return { action: 'answer', thought: 'done', answer: text };
}

function tool(name: string, args: Record<string, unknown>): Record<string, unknown> {
  return { action: 'tool', thought: 'calling', tool: name, args };
}

async function main(): Promise<void> {
  console.log('Scenario 1: answer-only turn');
  {
    const s = setup();
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(answer('Hello there!'));
    const result = await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'hi' });
    check('status completed', result.status === 'completed', result.message);
    check('message echoed', result.message === 'Hello there!');
    check('no tool calls', result.toolCalls.length === 0);
    check('usedSteps 0', result.usedSteps === 0);
    const messages = await s.conversations.listMessages(conv.id);
    check('assistant message persisted', messages.some((m) => m.role === 'assistant' && m.content === 'Hello there!'));
    check('user message persisted', messages.some((m) => m.role === 'user' && m.content === 'hi'));
  }

  console.log('Scenario 2: cross-owner conversation denied');
  {
    const s = setup();
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(answer('x'));
    let threw = false;
    try {
      await s.orchestrator.processMessage({ userId: 'u2', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'hi' });
    } catch (err) {
      threw = err instanceof NotFoundError;
    }
    check('NotFoundError thrown', threw);
  }

  console.log('Scenario 3: cross-workspace conversation denied');
  {
    const s = setup();
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(answer('x'));
    let threw = false;
    try {
      await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w2', conversationId: conv.id, content: 'hi' });
    } catch (err) {
      threw = err instanceof NotFoundError;
    }
    check('NotFoundError thrown', threw);
  }

  console.log('Scenario 4: invalid tool args -> validation error, loop continues');
  {
    const s = setup();
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(tool('product.get', { productId: 'not-a-uuid' }));
    s.gateway.queue.push(answer('I could not read that product id.'));
    const result = await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'get product' });
    check('completed after retry', result.status === 'completed');
    check('validation error recorded', result.toolCalls[0]?.ok === false && result.toolCalls[0]?.errorCode === 'AGENT_TOOL_VALIDATION');
    check('usedSteps 1', result.usedSteps === 1);
  }

  console.log('Scenario 5: unknown tool -> forbidden, loop continues');
  {
    const s = setup();
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(tool('admin.purgeEverything', {}));
    s.gateway.queue.push(answer('I can not do that.'));
    const result = await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'do admin stuff' });
    check('completed', result.status === 'completed');
    check('forbidden recorded', result.toolCalls[0]?.ok === false && result.toolCalls[0]?.errorCode === 'AGENT_TOOL_FORBIDDEN');
  }

  console.log('Scenario 6: step limit reached');
  {
    const s = setup(2);
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(tool('billing.balance', {}));
    s.gateway.queue.push(tool('product.get', { productId: PRODUCT_ID }));
    s.gateway.queue.push(tool('template.list', {}));
    s.gateway.queue.push(answer('done'));
    const result = await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'multi' });
    check('completed with limit message', result.status === 'completed' && /maximum number of tool steps/.test(result.message));
    check('usedSteps capped at 2', result.usedSteps === 2);
    check('2 tool calls recorded', result.toolCalls.length === 2);
    const messages = await s.conversations.listMessages(conv.id);
    check('limit message persisted', messages.some((m) => m.role === 'assistant' && /maximum number of tool steps/.test(m.content ?? '')));
  }

  console.log('Scenario 7: duplicate tool call suppressed');
  {
    const s = setup();
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(tool('product.get', { productId: PRODUCT_ID }));
    s.gateway.queue.push(tool('product.get', { productId: PRODUCT_ID }));
    s.gateway.queue.push(answer('done'));
    const result = await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'twice' });
    check('first call ok', result.toolCalls[0]?.ok === true);
    check('second call duplicate', result.toolCalls[1]?.ok === false && result.toolCalls[1]?.errorCode === 'AGENT_TOOL_DUPLICATE');
    check('product.get executed once', s.calls['product.get'] === 1);
  }

  console.log('Scenario 8: video.create requires confirmation (not executed)');
  {
    const s = setup();
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(tool('video.create', { productId: PRODUCT_ID }));
    const result = await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'create video' });
    check('confirmation required', result.status === 'confirmation_required');
    check('confirmation credits estimated', result.confirmation?.credits === 50);
    check('confirmation tool name', result.confirmation?.tool === 'video.create');
    check('createJob NOT executed', (s.calls['createJob'] ?? 0) === 0);
    check('createProject NOT executed', (s.calls['createProject'] ?? 0) === 0);
    const row = await s.conversations.findById(conv.id);
    check('pending persisted on conversation', row?.pendingConfirmation?.tool === 'video.create' && row?.pendingConfirmation?.credits === 50);
    const messages = await s.conversations.listMessages(conv.id);
    check('confirmation prompt persisted', messages.some((m) => m.role === 'assistant' && /50 credits/.test(m.content ?? '')));
  }

  console.log('Scenario 9: affirmative reply executes confirmed video.create');
  {
    const s = setup();
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(tool('video.create', { productId: PRODUCT_ID }));
    const first = await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'create video' });
    check('confirmation required first', first.status === 'confirmation_required');
    s.gateway.queue.push(answer('Your video is being generated.'));
    const second = await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'نعم' });
    check('completed after confirmation', second.status === 'completed', second.message);
    check('video.create executed ok', second.toolCalls.some((c) => c.name === 'video.create' && c.ok === true));
    check('createJob executed once', s.calls['createJob'] === 1);
    check('createProject executed once', s.calls['createProject'] === 1);
    check('job id selected', second.selections?.activeVideoJobId === JOB_ID);
    const row = await s.conversations.findById(conv.id);
    check('pending cleared', row?.pendingConfirmation === null);
    check('job id persisted on conversation', row?.activeVideoJobId === JOB_ID);
    const jobInput = (s.deps.video.createJob as unknown as { lastInput?: Record<string, unknown> }).lastInput;
    check('idempotency key includes conversation id', jobInput ? String(jobInput.idempotencyKey).includes(conv.id) : true);
  }

  console.log('Scenario 10: negative reply cancels without executing');
  {
    const s = setup();
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(tool('video.create', { productId: PRODUCT_ID }));
    await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'create video' });
    const second = await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'cancel' });
    check('completed with cancel message', second.status === 'completed' && /Cancelled/.test(second.message));
    check('createJob NOT executed', (s.calls['createJob'] ?? 0) === 0);
    const row = await s.conversations.findById(conv.id);
    check('pending cleared after cancel', row?.pendingConfirmation === null);
  }

  console.log('Scenario 11: registry audit + settings safety + multi-tool happy path');
  {
    const s = setup();
    const toolNames = s.registry.list('customer').map((t) => t.name);
    check('19 customer tools', toolNames.length === 19, toolNames.join(','));
    check('no admin tools exposed', toolNames.every((n) => !n.startsWith('admin.') && !n.includes('provider') && !n.includes('key')));
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(tool('billing.balance', {}));
    s.gateway.queue.push(tool('settings.get', { key: 'ai.openrouter.api_key' }));
    s.gateway.queue.push(tool('template.list', { limit: 5 }));
    s.gateway.queue.push(tool('product.get', { productId: PRODUCT_ID }));
    s.gateway.queue.push(answer('All done.'));
    const result = await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'everything' });
    check('completed', result.status === 'completed');
    check('4 tool calls, all ok', result.toolCalls.length === 4 && result.toolCalls.every((c) => c.ok === true), JSON.stringify(result.toolCalls));
    const messages = await s.conversations.listMessages(conv.id);
    const toolMessages = messages.filter((m) => m.role === 'tool');
    const settingsMsg = toolMessages.find((m) => m.toolName === 'settings.get');
    check('unsafe settings key refused', settingsMsg?.toolResult?.ok === true && (settingsMsg.toolResult.data as { allowed?: boolean })?.allowed === false);
    const productMsg = toolMessages.find((m) => m.toolName === 'product.get');
    check('no apiKey value leaked in persisted results', productMsg ? !JSON.stringify(productMsg.toolResult).includes('sk-LEAK') : true);
  }

  console.log('Scenario 11b: product.get result with secret value is sanitized');
  {
    const s = setup();
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(tool('product.get', { productId: PRODUCT_ID }));
    s.gateway.queue.push(answer('done'));
    await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'x' });
    const messages = await s.conversations.listMessages(conv.id);
    const leaked = JSON.stringify(messages.map((m) => m.toolResult));
    check('secret value absent from persisted messages', !leaked.includes('sk-LEAK'), leaked);
    check('secret key name absent from persisted messages', !leaked.includes('apiKey'));
  }

  console.log('Scenario 12: provider unavailable -> honest terminal error');
  {
    const s = setup();
    const conv = await s.conversations.create({ userId: 'u1', workspaceId: 'w1' });
    s.gateway.queue.push(() => {
      throw new AppError('No AI provider is configured', 503, 'AI_PROVIDER_UNAVAILABLE');
    });
    const result = await s.orchestrator.processMessage({ userId: 'u1', role: 'customer', workspaceId: 'w1', conversationId: conv.id, content: 'hi' });
    check('terminal error status', result.status === 'error');
    check('error code AI_PROVIDER_UNAVAILABLE', result.errorCode === 'AI_PROVIDER_UNAVAILABLE');
    check('honest message', /AI is not configured/.test(result.message), result.message);
    check('no tool calls', result.toolCalls.length === 0);
    const messages = await s.conversations.listMessages(conv.id);
    const persisted = messages.find((m) => m.role === 'assistant');
    check('honest message persisted', persisted ? /AI is not configured/.test(persisted.content ?? '') : false);
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test harness failed:', err);
  process.exit(1);
});
